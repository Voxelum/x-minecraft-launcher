import { CurseforgeV1Client } from '@xmcl/curseforge'
import {
  InstanceFileOperationHandler as InstanceFileOperationHandlerV2,
  InstanceInstallManifest,
  InstanceInstallLock,
  InstanceLockSchema,
  computeFileUpdates,
  mergeInstanceInstallManifest,
  type InstanceFile,
  type InstanceUpstream,
} from '@xmcl/instance'
import { ModrinthV2Client } from '@xmcl/modrinth'
import {
  ResourceManager,
  getDomainedPath,
  getFile,
  isValidModrinthId,
  type File,
  type ResourceMetadata,
} from '@xmcl/resource'
import {
  InstanceInstallServiceKey,
  InstanceInstallStatus,
  InstallInstanceTask,
  InstallInstanceTrackerEvents,
  LockKey,
  getModUpgradeFilenameMappings,
  isUpstreamIsSameOrigin,
  migrateModGroupFilenames,
  type InstanceInstallService as IInstanceInstallService,
  type InstallFileError,
  type InstallInstanceOptions,
  type InstanceFileUpdate,
  type SharedState,
} from '@xmcl/runtime-api'
import { Tracker } from '@xmcl/installer'
import { AnyError, isSystemError } from '@xmcl/utils'
import { FSWatcher } from 'chokidar'
import { randomUUID } from 'crypto'
import filenamify from 'filenamify'
import { unwatchFile, watchFile, type Stats } from 'fs'
import { ensureDir, pathExists, readJSON, readJson, remove, rename, rmdir, stat, unlink, writeFile, writeJson } from 'fs-extra'
import { basename, dirname, join, relative, resolve } from 'path'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { ZipManager, kTasks, type Tasks } from '~/infra'
import { InstanceService } from '~/instance/InstanceService'
import { InstanceModsGroupService } from '~/instance/InstanceModsGroupService'
import { kDownloadOptions } from '~/network'
import { kPeerFacade } from '~/peer'
import { kResourceManager, kResourceWorker, type ResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { downloadInstanceFiles } from './utils/downloadInstanceFiles'
import { linkInstanceFiles } from './utils/linkInstanceFiles'
import { unzipInstanceFiles } from './utils/unzipInstanceFiles'
import { resolveInstanceFiles } from './utils/resolveInstanceFiles'
import { getTracker } from '~/util/taskHelper'
import { readPendingInstalls, writeInstallState } from './utils/pendingInstall'
import { activeInstallFiles, hasInstallWork, installPathKey, supersedeInstallPlans } from './utils/installPlan'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceInstallServiceKey)
export class InstanceInstallService extends AbstractService implements IInstanceInstallService {
  private readonly pendingInstallRefreshers = new Map<string, () => Promise<void>>()
  private readonly activeInstallTasks = new Map<string, AbortController>()
  private readonly installRegistrations = new Map<string, Promise<void>>()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kResourceManager) private resourceManager: ResourceManager,
    @Inject(kTasks) private tasks: Tasks,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(CurseforgeV1Client) private curseforgeClient: CurseforgeV1Client,
    @Inject(ModrinthV2Client) private modrinthClient: ModrinthV2Client,
  ) {
    super(app)
  }

  async getLegacyLock(instancePath: string) {
    const instanceService = await this.app.registry.get(InstanceService)
    const inst = instanceService.state.all[instancePath]
    const upstream = inst.upstream
    if (!upstream) return undefined
    const resourceManager = this.resourceManager
    if (upstream.type === 'modrinth-modpack') {
      let metadata: ResourceMetadata | undefined
      if (upstream.sha1) {
        metadata = await resourceManager.getMetadataByHash(upstream.sha1)
      } else {
        const hash = await resourceManager.getHashByUri(
          `modrinth:${upstream.projectId}:${upstream.versionId}`,
        )
        if (hash) {
          metadata = await resourceManager.getMetadataByHash(hash)
        }
      }
      if (metadata) {
        if (metadata.instance) {
          return {
            version: 1,
            upstream,
            files: metadata.instance.files,
          }
        }
      }
    }
    if (upstream.type === 'curseforge-modpack') {
      let metadata: ResourceMetadata | undefined
      if (upstream.sha1) {
        metadata = await resourceManager.getMetadataByHash(upstream.sha1)
      } else {
        const hash = await resourceManager.getHashByUri(
          `curseforge:${upstream.modId}:${upstream.fileId}`,
        )
        if (hash) {
          metadata = await resourceManager.getMetadataByHash(hash)
        }
      }
      if (metadata) {
        if (metadata.instance) {
          return {
            upstream,
            files: metadata.instance.files,
          }
        }
      }
    }
    return undefined
  }

  private getSha1 = async (instancePath: string, file: File) => {
    const snapshot = await this.resourceManager.getSnapshotByDomainedPath(
      getDomainedPath(file.path, instancePath),
    )
    if (snapshot && snapshot.mtime === file.mtime && snapshot.ino === file.ino) {
      return snapshot.sha1
    }
    return this.worker.checksum(file.path, 'sha1')
  }

  private getInstallFile = async (path: string) => {
    const file = await getFile(path)
    return file?.isDirectory ? undefined : file
  }

  private getCrc32 = async (instancePath: string, file: File) => {
    return await this.worker.checksum(file.path, 'crc32')
  }

  private getChecksum = async (_instancePath: string, file: File, algorithm: string) =>
    this.worker.checksum(file.path, algorithm)

  async #getDelta(
    instancePath: string,
    lockState: InstanceLockSchema | undefined,
    newUpstream: InstanceUpstream,
    newFiles: InstanceFile[],
  ) {
    let fileDelta: InstanceFileUpdate[] = []
    const fs = { getFile: this.getInstallFile, getSha1: this.getSha1, getCrc32: this.getCrc32, getChecksum: this.getChecksum, join }

    if (lockState) {
      // check if upstream are the same
      if (isUpstreamIsSameOrigin(newUpstream, lockState.upstream)) {
        fileDelta = await computeFileUpdates(
          instancePath,
          lockState.files,
          newFiles,
          lockState.mtime,
          fs,
        )
      } else {
        throw new AnyError('InstanceUpstreamError', 'The instance is locked by another upstream')
      }
    } else {
      const legacy = await this.getLegacyLock(instancePath)
      if (legacy) {
        const { upstream, files } = legacy
        if (isUpstreamIsSameOrigin(newUpstream, upstream)) {
          fileDelta = await computeFileUpdates(instancePath, files, newFiles, undefined, fs)
        } else {
          throw new AnyError('InstanceUpstreamError', 'The instance is locked by another upstream')
        }
      } else {
        fileDelta = await computeFileUpdates(instancePath, [], newFiles, undefined, fs)
      }
    }
    return fileDelta
  }

  async #install(
    instancePath: string,
    lockState: InstanceLockSchema | undefined,
    targetState: InstanceInstallLock,
    id?: string,
    noLock?: boolean,
    profilePath = join(instancePath, '.install-profile'),
    resuming = false,
    legacyBaseline?: { upstream: InstanceUpstream; files: InstanceFile[] } | null,
  ) {
    const previousRegistration = this.installRegistrations.get(instancePath)
    const registered = Promise.withResolvers<void>()
    if (!resuming) this.installRegistrations.set(instancePath, registered.promise)
    const releaseRegistration = () => {
      registered.resolve()
      if (this.installRegistrations.get(instancePath) === registered.promise) this.installRegistrations.delete(instancePath)
    }
    return this.mutex.of(`instance-install-operation:${profilePath}`).runExclusive(async () => {
      if (!resuming) await previousRegistration
      if (resuming) {
        const saved = await readJson(profilePath).then(InstanceInstallLock.parse).catch((error) => {
          if (isSystemError(error) && error.code === 'ENOENT') return undefined
          throw error
        })
        if (!saved) return false
        targetState = { ...saved, files: targetState.files, oldFiles: targetState.oldFiles }
        await this.mutex.of(LockKey.instance(instancePath)).runExclusive(async () => {
          await stat(instancePath)
          if (dirname(targetState.workspace) === dirname(instancePath) &&
              basename(targetState.workspace).startsWith(`.${basename(instancePath)}-install-`)) {
            const workspace = join(instancePath, '.install', randomUUID(), 'files')
            await ensureDir(dirname(workspace))
            if (await pathExists(targetState.workspace)) await rename(targetState.workspace, workspace)
            targetState.workspace = workspace
            await writeInstallState(profilePath, targetState)
          }
        })
      }
      return this.#runInstall(
        instancePath, lockState, targetState, id, noLock, profilePath, resuming, releaseRegistration, legacyBaseline,
      )
    }).finally(releaseRegistration)
  }

  async #runInstall(
    instancePath: string,
    lockState: InstanceLockSchema | undefined,
    targetState: InstanceInstallLock,
    id: string | undefined,
    noLock: boolean | undefined,
    profilePath: string,
    resuming: boolean,
    releaseRegistration: () => void,
    legacyBaseline?: { upstream: InstanceUpstream; files: InstanceFile[] } | null,
  ) {
    const lockFilePath = join(instancePath, 'instance-lock.json')
    const currentStatePath = profilePath
    const originalDirectory = await stat(instancePath)

    const curseforgeClient = this.curseforgeClient
    const modrinthClient = this.modrinthClient
    const zipManager = await this.app.registry.getOrCreate(ZipManager)
    const resourceToUpdate: Array<{
      hash: string
      metadata: ResourceMetadata
      uris: string[]
      destination: string
    }> = []
    const downloadOptions = await this.app.registry.get(kDownloadOptions)

    const lock = this.mutex.of(LockKey.instance(instancePath))
  // eslint-disable-next-line @typescript-eslint/no-this-alias
    const logger = this

    // Track the task at service level. Created BEFORE the lock so the
    // abort handler below has a stable controller to flip when
    // deleteInstance fires while we're still waiting for the lock.
    const task = this.tasks.create<InstallInstanceTask>({
      type: 'installInstance',
      key: `install-instance-${instancePath}`,
      instancePath,
      taskId: id,
    })
    this.activeInstallTasks.set(profilePath, task.controller)

    // Race fix: deleteInstance and #install used to take different
    // mutex keys, so `rm -rf <instance>` could run while our install
    // was still writing files (ENOENT/EPERM/EBUSY storm on
    // .install-profile / staging-dir rename). We now:
    //   1. Register a strong-ref abort callback so deleteInstance can
    //      cancel us fast (held to keep the closure alive — previously
    //      handlers were WeakRef'd and could be GC'd mid-install).
    //   2. Serialize every instance mutation on the same LockKey.instance(p)
    //      that deleteInstance waits on. Local diff installs may prepare in
    //      an isolated workspace before taking this lock.
    const instanceService = await this.app.registry.get(InstanceService)
    let removing = false
    let preparing = false
    const writersSettled = Promise.withResolvers<void>()
    const abortOnRemove = () => {
      removing = true
      task.controller.abort()
      // Preparation runs outside the instance mutex. Deletion must wait
      // for its writers, but not for the commit that also needs that mutex.
      return preparing ? writersSettled.promise : undefined
    }
    const unregisterRemoveHandler = instanceService.registerRemoveHandler(
      instancePath,
      abortOnRemove,
    )
    const checkInstance = async () => {
      const directory = await stat(instancePath).catch((error) => {
        if (isSystemError(error) && error.code === 'ENOENT') return undefined
        throw error
      })
      if (removing || !directory || directory.ino !== originalDirectory.ino) {
        removing = true
        task.controller.abort()
        throw task.controller.signal.reason
      }
    }
    const onDirectoryChange = (current: Stats) => {
      if (current.nlink === 0 || current.ino !== originalDirectory.ino) void abortOnRemove()
    }
    watchFile(instancePath, { interval: 100, persistent: false }, onDirectoryChange)

    const updateResources = async () => {
      try {
        if (resourceToUpdate.length > 0) {
          const publishedDestinations = new Set([...handler.committed].map(path => join(instancePath, path)))
          const options = await Promise.all(
            resourceToUpdate.filter(resource => publishedDestinations.has(resource.destination))
              .map(async ({ hash, metadata, uris, destination }) => {
              const actualSha1 =
                hash ?? (await this.worker.checksum(destination, 'sha1').catch(() => undefined))
              return {
                hash: actualSha1,
                metadata,
                uris,
              }
            }),
          )

          const toQuery = options
            .filter((r) => Object.keys(r.metadata).length === 0)
            .map((r) => r.hash)
          if (toQuery.length > 0) {
            const modrinthMetadata = await modrinthClient.getProjectVersionsByHash(toQuery, 'sha1')

            for (const o of options) {
              const modrinth = modrinthMetadata[o.hash]
              if (modrinth && isValidModrinthId(modrinth.project_id) && isValidModrinthId(modrinth.id)) {
                o.metadata.modrinth = {
                  projectId: modrinth.project_id,
                  versionId: modrinth.id,
                }
              }
            }
          }

          await this.resourceManager.updateMetadata(options.filter((o) => !!o.hash))
        }
      } catch (e) {
        this.logger.error(e as any)
      }
    }

    // Create tracker that updates task substate
    const tracker: Tracker<InstallInstanceTrackerEvents> = getTracker(task)

    const createHandler = (finished: Set<string>) => new InstanceFileOperationHandlerV2(
      instancePath,
      finished,
      targetState.workspace,
      targetState.backup,
      {
        worker: this.worker,
        logger: this,
        onSpecialFile: (file) => {
          resourceToUpdate.push({
            hash: file.hashes.sha1,
            metadata: {
              modrinth: file.modrinth,
              curseforge: file.curseforge,
            },
            uris: file.downloads || [],
            destination: join(instancePath, file.path),
          })
        },
        getCachedResource: (sha1) =>
          this.resourceManager
            .getSnapshotByHash(sha1)
            .then((resource) => resource ? this.resourceManager.validateSnapshotFile(resource) : undefined)
            .then((resource) => resource?.path),
        getPeerActualUrl: (url) =>
          this.app.registry
            .getIfPresent(kPeerFacade)
            .then((peers) => peers?.getHttpDownloadUrl(url)),
        unzipFiles: (payloads, finished, signal) =>
          unzipInstanceFiles(zipManager, payloads, finished, signal, tracker),
        downloadFiles: (payloads, finished, signal) =>
          downloadInstanceFiles(
            payloads.map((value) => ({
              options: {
                url: value.options.urls,
                validator: value.options.sha1 ? { algorithm: 'sha1', hash: value.options.sha1 } : undefined,
                destination: value.options.destination,
                expectedTotal: value.options.size,
              },
              file: value.file,
            })),
            finished,
            signal,
            downloadOptions,
            tracker,
          ),
        linkFiles: (payloads, finished, unhandled, signal) =>
          linkInstanceFiles(payloads, this.app.platform, finished, unhandled, signal, tracker),
      },
    )

    const resolveAddedFiles = async (fileDelta: InstanceFileUpdate[]) => {
      try {
        const newAddedFiles = fileDelta
          .filter((file) => file.operation === 'add' || file.operation === 'backup-add')
          .map((file) => file.file)
        return await resolveInstanceFiles(
          newAddedFiles,
          curseforgeClient,
          modrinthClient,
          task.controller.signal,
        )
      } catch (error) {
        this.warn('Failed to refresh instance file download sources', error)
        return false
      }
    }

    const reconcileUnresolved = async (unresolvable: InstanceFile[]) => {
      const unresolvedFilesPath = join(instancePath, 'unresolved-files.json')
      const targetPaths = new Set(activeInstallFiles(targetState).map(file => installPathKey(file.path)))
      const attemptedPaths = new Set([
        ...targetPaths,
        ...activeInstallFiles(targetState, true).map(file => installPathKey(file.path)),
      ])
      const existingUnresolved: InstanceFile[] = await readJSON(unresolvedFilesPath).catch((error) => {
        if (isSystemError(error) && error.code === 'ENOENT') return []
        throw error
      })
      const mergedUnresolved = existingUnresolved
        .filter((file) => !attemptedPaths.has(installPathKey(file.path)))
        .concat(unresolvable.filter(file => targetPaths.has(installPathKey(file.path))))
      if (mergedUnresolved.length > 0) {
        await writeInstallState(unresolvedFilesPath, mergedUnresolved)
      } else {
        await unlink(unresolvedFilesPath).catch((error) => {
          if (!isSystemError(error) || error.code !== 'ENOENT') throw error
        })
      }
    }

    const errors: unknown[] = []
    let superseded = false
    let acceptingReady = false
    let flushTimer: ReturnType<typeof setTimeout> | undefined
    let flushing: Promise<void> | undefined
    const batchSize = 256
    const finished = new class extends Set<string> {
      add(path: string) {
        super.add(path)
        scheduleFlush()
        return this
      }
    }()
    const handler = createHandler(finished)
    const refreshStatus = () => this.pendingInstallRefreshers.get(instancePath)?.()
    const readLock = () => readJson(lockFilePath).then(InstanceLockSchema.parse).catch((error) => {
      if (isSystemError(error) && error.code === 'ENOENT') return undefined
      throw error
    })
    const loadCurrentPlan = async () => {
      const profiles = await readPendingInstalls(instancePath)
      const current = profiles.find(profile => profile.path === profilePath)
      if (!current) {
        superseded = true
        throw new DOMException('Installation superseded by a newer plan', 'AbortError')
      }
      targetState = current.state
      // Also covers a crash between publishing a newer plan and recording its
      // ownership transfers in the older profiles.
      for (const newer of profiles.filter(profile =>
        (profile.state.revision ?? 0) > (targetState.revision ?? 0),
      )) {
        const result = supersedeInstallPlans(newer.state, [{ path: profilePath, state: targetState }])
        if (result.superseded[0]) targetState = result.superseded[0].state
      }
      if (!hasInstallWork(targetState) && targetState.supersededPaths?.length) {
        superseded = true
        throw new DOMException('Installation superseded by a newer plan', 'AbortError')
      }
    }
    const delta = (ready?: Set<string>) => {
      const files = activeInstallFiles(targetState)
      const baseline = activeInstallFiles(targetState, true)
      return computeFileUpdates(
        instancePath,
        ready ? baseline.filter(file => ready.has(file.path)) : baseline,
        ready ? files.filter(file => ready.has(file.path)) : files,
        noLock ? undefined : targetState.baseline?.mtime,
        { getFile: this.getInstallFile, getSha1: this.getSha1, getCrc32: this.getCrc32, getChecksum: this.getChecksum },
      )
    }
    const initialize = async () => {
      task.controller.signal.throwIfAborted()
      await checkInstance()
      lockState = await readLock()
      const profiles = await readPendingInstalls(instancePath)
      const saved = profiles.find(profile => profile.path === profilePath)?.state
      if (saved) targetState = { ...targetState, ...saved, files: targetState.files }
      if (!noLock && lockState && !isUpstreamIsSameOrigin(lockState.upstream, targetState.upstream)) {
        throw new AnyError('InstanceUpstreamError', 'The instance is locked by another upstream')
      }
      if (!targetState.baseline) {
        const legacy = !noLock && !lockState
          ? (legacyBaseline !== undefined ? legacyBaseline : await this.getLegacyLock(instancePath))
          : undefined
        if (legacy && !isUpstreamIsSameOrigin(legacy.upstream, targetState.upstream)) {
          throw new AnyError('InstanceUpstreamError', 'The instance is locked by another upstream')
        }
        targetState.baseline = {
          files: noLock ? targetState.oldFiles ?? [] : lockState?.files ?? legacy?.files ?? [],
          mtime: noLock ? undefined : lockState?.mtime,
        }
      }
      targetState.operationId ??= randomUUID()
      targetState.revision ??= resuming ? targetState.mtime : Math.max(Date.now(), ...profiles.map(profile => profile.state.revision ?? 0)) + 1
      const previous = profiles.filter(profile => profile.path !== profilePath &&
        (profile.state.revision ?? 0) < targetState.revision!)
      const transfer = supersedeInstallPlans(targetState, previous)
      targetState = transfer.plan
      await ensureDir(dirname(currentStatePath))
      await ensureDir(targetState.workspace)
      await writeInstallState(currentStatePath, targetState)
      for (const older of transfer.superseded) {
        await writeInstallState(older.path, older.state)
        if (!hasInstallWork(older.state)) {
          const active = this.activeInstallTasks.get(older.path)
          if (active) {
            active.abort(new DOMException('Installation superseded by a newer plan', 'AbortError'))
          } else {
            await remove(older.state.workspace)
            if (dirname(dirname(older.state.workspace)) === join(instancePath, '.install')) {
              await rmdir(dirname(older.state.workspace)).catch((error) => {
                if (!isSystemError(error) || !['ENOENT', 'ENOTEMPTY'].includes(error.code)) throw error
              })
            }
            await unlink(older.path)
          }
        }
      }
      await loadCurrentPlan()
      await refreshStatus()
      return delta()
    }
    const prepare = async (updates: InstanceFileUpdate[]) => {
      try {
        await resolveAddedFiles(updates)
        await lock.runExclusive(async () => {
          await checkInstance()
          await loadCurrentPlan()
          const refreshed = new Map(updates.map(update => [update.file.path, update.file]))
          targetState.files = targetState.files.map(file => refreshed.get(file.path) ?? file)
          await writeInstallState(currentStatePath, targetState)
        })
        task.controller.signal.throwIfAborted()
        preparing = true
        acceptingReady = true
        await handler.prepareInstallFiles(updates, task.controller.signal, true)
        task.controller.signal.throwIfAborted()
      } catch (error) {
        errors.push(error)
        logger.warn('Install instance files error', error)
      } finally {
        preparing = false
        writersSettled.resolve()
      }
    }
    const commit = async (updates: InstanceFileUpdate[], final: boolean) => {
      await checkInstance()
      try {
        await handler.commitReadyFiles(updates, final && errors.length === 0 && !task.controller.signal.aborted, checkInstance)
      } catch (error) {
        errors.push(error)
      }
      for (const path of handler.committed) handler.finished.delete(path)
      await checkInstance()
      const missing = updates.filter(({ file, operation }) =>
        (operation === 'add' || operation === 'backup-add') && !handler.committed.has(file.path),
      )
      if (final && missing.length && errors.length === 0) {
        errors.push(new AnyError('UnresolvedInstanceFilesError', `Unable to install ${missing.length} instance files`))
      }
      if (final && task.controller.signal.aborted && errors.length === 0) errors.push(task.controller.signal.reason)

      // A lock describes what was actually published, never the entire target
      // of a failed installation. Keep the old timestamp until completion so
      // user edits to files that have not been replaced remain protected.
      try {
        if (!noLock) {
          const latestLock = await readLock()
          const existingFiles = latestLock?.files ?? (await Promise.all(
            (targetState.baseline?.files ?? []).map(async file =>
              await this.getInstallFile(join(instancePath, file.path)) ? file : undefined),
          )).filter(file => file !== undefined)
          const actual = new Map(existingFiles.map(file => [file.path, file]))
          for (const file of activeInstallFiles(targetState)) {
            if (handler.committed.has(file.path)) actual.set(file.path, file)
          }
          for (const path of handler.removed) actual.delete(path)
          await writeInstallState(lockFilePath, InstanceLockSchema.parse({
            version: 1,
            files: final && !errors.length && !targetState.supersededPaths?.length ? targetState.files : [...actual.values()],
            upstream: targetState.supersededPaths?.length ? latestLock?.upstream ?? targetState.upstream : targetState.upstream,
            mtime: final && !errors.length && !targetState.supersededPaths?.length ? Date.now() : (targetState.baseline?.mtime ?? 0),
          }))
        }
        const published = new Set(final ? [] : targetState.committedPath ?? [])
        for (const path of handler.committed) published.add(path)
        targetState.committedPath = [...published].filter(path =>
          !targetState.supersededPaths?.includes(installPathKey(path)),
        )
        targetState.finishedPath = [...handler.finished]
        await writeInstallState(currentStatePath, targetState)
        await refreshStatus()
        if (final) await reconcileUnresolved(handler.unresolvable)
      } catch (error) {
        errors.push(error)
      }
      if (!final) return
      await updateResources()
      if (errors.length === 1) throw errors[0]
      if (errors.length) throw new AggregateError(errors)
      await cleanup()
    }
    const cleanup = async () => {
      await remove(targetState.workspace)
      await unlink(currentStatePath).catch((error) => {
        if (!isSystemError(error) || error.code !== 'ENOENT') throw error
      })
      await refreshStatus()
      const stagingRoot = join(instancePath, '.install')
      if (dirname(dirname(targetState.workspace)) === stagingRoot) {
        for (const directory of [dirname(targetState.workspace), stagingRoot]) {
          await rmdir(directory).catch((error) => {
            if (isSystemError(error) && ['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) return
            throw error
          })
        }
      }
    }

    const flushReady = async () => {
      await lock.runExclusive(async () => {
        await checkInstance()
        await loadCurrentPlan()
        const active = new Set(activeInstallFiles(targetState).map(file => file.path))
        for (const path of handler.finished) {
          if (!active.has(path)) handler.finished.delete(path)
        }
        const ready = new Set([...handler.finished].slice(0, batchSize))
        if (ready.size) {
          await commit(await delta(ready), false)
          if (errors.length) throw errors[errors.length - 1]
        }
      })
    }
    const startFlush = () => {
      flushTimer = undefined
      if (flushing || !acceptingReady) return
      flushing = flushReady().catch((error) => {
        if (!errors.includes(error)) errors.push(error)
        task.controller.abort(error)
      }).finally(() => {
        flushing = undefined
        if (acceptingReady && !errors.length && handler.finished.size) scheduleFlush()
      })
    }
    function scheduleFlush() {
      if (!acceptingReady || flushing || errors.length) return
      if (handler.finished.size >= batchSize) {
        if (flushTimer) clearTimeout(flushTimer)
        startFlush()
      } else if (!flushTimer) {
        flushTimer = setTimeout(startFlush, 1000)
      }
    }

    try {
      const updates = await lock.runExclusive(initialize)
      releaseRegistration()
      await prepare(updates)
      acceptingReady = false
      if (flushTimer) clearTimeout(flushTimer)
      await flushing
      await lock.runExclusive(async () => {
        await checkInstance()
        try {
          await loadCurrentPlan()
        } catch (error) {
          if (superseded) await cleanup()
          throw error
        }
        await commit(await delta(), true)
      })
      task.complete()
      return true
    } catch (e) {
      writersSettled.resolve()
      if (superseded) {
        await lock.runExclusive(async () => {
          await checkInstance()
          await cleanup()
        })
        if (resuming) {
          task.complete()
          return false
        }
      }
      const attachInstance = (error: unknown) => {
        if (error instanceof Error) Object.assign(error, { installInstance: { instancePath } })
        // IPC unwraps aggregate errors, so retained-instance information must
        // also travel on each leaf error.
        if (error instanceof AggregateError) error.errors.forEach(attachInstance)
      }
      attachInstance(e)
      task.fail(e as Error)
      // AbortError = deleteInstance triggered our remove handler, or
      // the user cancelled the task. ErrorDiagnose:118 already drops
      // this from telemetry — DON'T rewrite the name, or it will
      // resurface as InstallInstanceFilesError.
      if ((e as any)?.name === 'AbortError') {
        throw e
      }
      // async-mutex E_CANCELED: instanceLock.cancel() rejected us
      // while we were queued behind a now-deleted instance. Same
      // semantic as abort — surface as AbortError so the existing
      // suppression catches it instead of a noisy
      // InstallInstanceFilesError telemetry event.
      if ((e as any)?.message === 'request for lock canceled') {
        const cancelled = new Error('Install canceled by instance removal')
        ;(cancelled as any).name = 'AbortError'
        throw cancelled
      }
      throw Object.assign(e as any, {
        name: (e as any).name === 'Error' ? 'InstallInstanceFilesError' : (e as any).name,
        installInstance: {
          instancePath,
        },
      })
    } finally {
      acceptingReady = false
      if (flushTimer) clearTimeout(flushTimer)
      await flushing
      writersSettled.resolve()
      unwatchFile(instancePath, onDirectoryChange)
      unregisterRemoveHandler()
      this.activeInstallTasks.delete(profilePath)
    }
  }

  async previewInstanceFiles(options: InstallInstanceOptions): Promise<InstanceFileUpdate[]> {
    const { path: instancePath } = options
    const lockFilePath = join(instancePath, 'instance-lock.json')
    const lockState = await readJson(lockFilePath)
      .then(InstanceLockSchema.parse)
      .catch(() => undefined)

    if ('upstream' in options) {
      const delta = await this.#getDelta(instancePath, lockState, options.upstream, options.files)
      return delta
    }

    const fs = { getFile: this.getInstallFile, getSha1: this.getSha1, getCrc32: this.getCrc32, getChecksum: this.getChecksum, join }
    return await computeFileUpdates(instancePath, options.oldFiles, options.files, Date.now(), fs)
  }

  async getInstanceInstallManifest(path: string): Promise<InstanceInstallManifest | undefined> {
    return readJson(join(path, '.install-manifest'))
      .then(InstanceInstallManifest.parse)
      .catch(() => undefined)
  }

  async stageInstanceFiles(options: Extract<InstallInstanceOptions, { oldFiles: InstanceFile[] }>): Promise<InstanceInstallManifest> {
    const lock = this.mutex.of(LockKey.instanceManifest(options.path))
    return lock.runExclusive(async () => {
      const current = await this.getInstanceInstallManifest(options.path)
      const manifest = mergeInstanceInstallManifest(current, options)
      await writeJson(join(options.path, '.install-manifest'), manifest)
      return manifest
    })
  }

  async setInstanceInstallManifest(options: Extract<InstallInstanceOptions, { oldFiles: InstanceFile[] }>): Promise<InstanceInstallManifest | undefined> {
    const lock = this.mutex.of(LockKey.instanceManifest(options.path))
    return lock.runExclusive(async () => {
      const manifestPath = join(options.path, '.install-manifest')
      if (!options.oldFiles.length && !options.files.length) {
        await unlink(manifestPath).catch(() => undefined)
        return undefined
      }
      const current = await this.getInstanceInstallManifest(options.path)
      const now = Date.now()
      const manifest: InstanceInstallManifest = {
        version: 1,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        oldFiles: options.oldFiles,
        files: options.files,
      }
      await writeJson(manifestPath, manifest)
      return manifest
    })
  }

  async applyInstanceInstallManifest(path: string, id?: string): Promise<void> {
    const lock = this.mutex.of(LockKey.instanceManifest(path))
    await lock.runExclusive(async () => {
      const manifest = await this.getInstanceInstallManifest(path)
      if (!manifest) return
      await this.installInstanceFiles({
        path,
        oldFiles: manifest.oldFiles,
        files: manifest.files,
        id,
      }, manifest.updatedAt)
      await unlink(join(path, '.install-manifest')).catch(() => undefined)
    })
  }

  async discardInstanceInstallManifest(path: string): Promise<void> {
    const lock = this.mutex.of(LockKey.instanceManifest(path))
    await lock.runExclusive(() => unlink(join(path, '.install-manifest')).catch(() => undefined))
  }

  async resumeInstanceInstall(
    instancePath: string,
    overrides?: InstanceFile[],
  ): Promise<void | InstallFileError[]> {
    return this.mutex.of(`${LockKey.instance(instancePath)}:resume`).runExclusive(async () => {
      const profiles = await readPendingInstalls(instancePath)
      for (const profile of profiles) {
        const result = await this.resumeInstallProfile(instancePath, profile.path, profile.state, overrides)
        if (result) return result
      }
    })
  }

  private async resumeInstallProfile(
    instancePath: string,
    currentStatePath: string,
    currentState: InstanceInstallLock,
    overrides?: InstanceFile[],
  ): Promise<void | InstallFileError[]> {
    const lockFilePath = join(instancePath, 'instance-lock.json')
    const lockState = await readJson(lockFilePath)
      .then(InstanceLockSchema.parse)
      .catch(() => undefined)

    if (overrides) {
      currentState.files = currentState.files.map(
        (f) => overrides.find((o) => o.path === f.path) ?? f,
      )
    }

    try {
      if (currentState.oldFiles === undefined &&
          currentState.upstream.type === 'peer' && currentState.upstream.id === '') {
        currentState.oldFiles = []
      }
      const installed = await this.#install(
        instancePath, lockState, currentState, undefined, currentState.oldFiles !== undefined, currentStatePath, true,
      )
      if (!installed) return
      if (currentState.oldFiles) {
        await this.#migrateModGroupFilenames(instancePath, currentState.oldFiles, currentState.files)
      }
      if (currentState.manifestUpdatedAt !== undefined) {
        await this.mutex.of(LockKey.instanceManifest(instancePath)).runExclusive(async () => {
          const manifest = await this.getInstanceInstallManifest(instancePath)
          if (manifest?.updatedAt === currentState.manifestUpdatedAt) {
            await unlink(join(instancePath, '.install-manifest'))
          }
        })
      }
    } catch (e) {
      const isChecksumError = (
        err: unknown,
      ): err is Error & { file: string; expect: string; actual: string } =>
        err instanceof Error && err.name === 'ChecksumNotMatchError'
      const findChecksumFile = (path: string) => currentState.files.find(file =>
        resolve(currentState.workspace, file.path) === resolve(path) ||
        resolve(instancePath, file.path) === resolve(path),
      )

      if (e instanceof AggregateError) {
        if (e.errors.every(err => isChecksumError(err) && findChecksumFile(err.file))) {
          return e.errors.map((err) => ({
            file: findChecksumFile(err.file)!,
            name: 'ChecksumNotMatchError' as const,
            expect: err.expect,
            actual: err.actual,
          }))
        }
      } else if (isChecksumError(e)) {
        const file = findChecksumFile(e.file)
        if (file) {
          return [
            {
              file: file,
              name: 'ChecksumNotMatchError' as const,
              expect: e.expect,
              actual: e.actual,
            },
          ]
        }
      } else {
        if (isSystemError(e) && e.code === 'ENOENT') {
          const path = e.path
          if (path) {
            const zipFileIsMissing = currentState.files.find(
              (f) =>
                f.downloads && f.downloads.some((d) => d.startsWith('zip://') && d.includes(path)),
            )
            if (zipFileIsMissing) {
              return [
                {
                  file: path,
                  name: 'UnpackZipFileNotFoundError',
                },
              ]
            }
          }
        }
      }
      throw e
    }
  }

  async watchInstanceInstall(path: string): Promise<SharedState<InstanceInstallStatus>> {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(`instance-install://${path}`, async () => {
      const status = new InstanceInstallStatus()
      status.instance = path
      let disposed = false
      let revision = 0
      const refreshPending = async () => {
        const currentRevision = ++revision
        try {
          const profiles = await readPendingInstalls(path)
          const count = profiles.reduce((total, { state }) => {
            if (!hasInstallWork(state) && state.supersededPaths?.length) return total
            const committed = new Set(state.committedPath ?? [])
            // A pending deletion/finalization still requires Continue even if
            // every target file has already been published.
            return total + Math.max(1, activeInstallFiles(state).filter(file => !committed.has(file.path)).length)
          }, 0)
          if (!disposed && currentRevision === revision) status.pendingFileCountSet(count)
        } catch (error) {
          this.warn('Failed to read pending instance installs', error)
          if (!disposed && currentRevision === revision) status.pendingFileCountSet(Math.max(1, status.pendingFileCount))
        }
      }
      // Native watchers can coalesce atomic replacements or lose a removed
      // staging directory. Our own writes explicitly refresh the shared state.
      this.pendingInstallRefreshers.set(path, refreshPending)
      await refreshPending()
      const watcher = new FSWatcher({
        cwd: path,
        depth: 2,
        ignored: (candidate) => {
          const entry = relative(path, resolve(path, candidate)).replace(/\\/g, '/')
          return entry !== '' && entry !== '.install' && entry !== '.install-profile' &&
            entry !== 'unresolved-files.json' && !/^\.install\/[^/]+\.json$/.test(entry)
        },
      })
        // Chokidar internally calls `fs.stat`/`lstat` on each watched
        // path; failures (EPERM/EBUSY/EACCES from AV/OneDrive, ENOENT
        // when the file was deleted between scans) become an 'error'
        // event. Without a listener they bubble as raw `Error` with
        // `name === 'Error'`, indistinguishable in telemetry from every
        // other unwrapped throw (#1457). Tag them so the next pass can
        // see exactly which subsystem is producing the noise — these
        // are transient and the watcher recovers on its own, so we
        // swallow after renaming + logging.
        .on('error', (e: any) => {
          if (e && typeof e === 'object' && e.name === 'Error') {
            e.name = 'InstanceInstallWatcherError'
          }
          if (isSystemError(e)) {
            this.warn(e)
          } else {
            this.error(e)
          }
        })
        .on('all', async (ev, filePath) => {
          if (filePath === '.install' || filePath === '.install-profile' ||
              (dirname(filePath) === '.install' && filePath.endsWith('.json'))) {
            await refreshPending()
            return
          }
          if (ev === 'add' || ev === 'change') {
            if (filePath === 'unresolved-files.json') {
              const unresolvedFilesPath = join(path, 'unresolved-files.json')
              const unresolvedFiles = await readJSON(unresolvedFilesPath).catch(() => [])
              status.unresolvedFilesSet(unresolvedFiles)
            }
          } else if (ev === 'unlink') {
            if (filePath === 'unresolved-files.json') {
              status.unresolvedFilesSet([])
            }
          }
        })
        .add('.')

      return [
        status,
        () => {
          disposed = true
          if (this.pendingInstallRefreshers.get(path) === refreshPending) {
            this.pendingInstallRefreshers.delete(path)
          }
          watcher.close()
        },
        refreshPending,
      ]
    })
  }

  async installInstanceFiles(
    options: InstallInstanceOptions,
    manifestUpdatedAt?: number,
    legacyBaseline?: { upstream: InstanceUpstream; files: InstanceFile[] } | null,
  ): Promise<void> {
    const { path: instancePath, files, id } = options

    const timestamp = Date.now()
    this.log('Install instance files', instancePath, id)

    if ('upstream' in options) {
      const operationId = randomUUID()
      const upstream = options.upstream
      const currentState: InstanceInstallLock = {
        version: 0,
        files,
        upstream,
        mtime: timestamp,
        backup: join(
          instancePath,
          '.backups',
          `${filenamify(new Date().toLocaleString(), { replacement: '-' })}-${operationId}`,
        ),
        workspace: join(instancePath, '.install', operationId, 'files'),
        finishedPath: [],
        operationId,
      }

      this.log('Install instance files with upstream')
      await this.#install(
        instancePath, undefined, currentState, id, false, join(instancePath, '.install', `${operationId}.json`),
        false, legacyBaseline,
      )
    } else {
      const oldFiles = options.oldFiles
      const files = options.files
      const operationId = randomUUID()

      const lockState: InstanceLockSchema = {
        version: 1,
        files: oldFiles,
        upstream: {
          type: 'peer',
          id: '',
        },
        mtime: timestamp,
      }

      const currentState: InstanceInstallLock = {
        version: 1,
        files,
        upstream: {
          type: 'peer',
          id: '',
        },
        mtime: timestamp,
        backup: join(
          instancePath,
          '.backups',
          operationId,
        ),
        workspace: join(instancePath, '.install', operationId, 'files'),
        finishedPath: [],
        oldFiles,
        manifestUpdatedAt,
        operationId,
      }

      this.log('Install instance files with diff')
      await this.#install(
        instancePath, lockState, currentState, id, true, join(instancePath, '.install', `${operationId}.json`),
      )
      await this.#migrateModGroupFilenames(instancePath, oldFiles, files)
    }
  }

  async #migrateModGroupFilenames(instancePath: string, oldFiles: readonly InstanceFile[], files: readonly InstanceFile[]) {
    const isMod = (file: InstanceFile) => file.path.replace(/\\/g, '/').startsWith('mods/')
    const mappings = getModUpgradeFilenameMappings(oldFiles.filter(isMod), files.filter(isMod))
    if (Object.keys(mappings).length === 0) return

    try {
      const service = await this.app.registry.get(InstanceModsGroupService)
      const state = await service.getGroupState(instancePath)
      const migrated = migrateModGroupFilenames(state.groups, mappings)
      if (migrated !== state.groups) await service.updateModsGroups(instancePath, migrated)
    } catch (error) {
      this.warn(`Failed to migrate mod group filenames for ${instancePath}`, error)
    }
  }

  async dismissUnresolvedFiles(path: string, files?: string[]): Promise<void> {
    const unresolvedFilesPath = join(path, 'unresolved-files.json')
    if (files && files.length > 0) {
      // Dismiss only the requested files, keeping the rest so the user can
      // still resolve them later. Drop the file entirely once it is empty.
      const current: InstanceFile[] = await readJSON(unresolvedFilesPath).catch(() => [])
      const toDismiss = new Set(files)
      const remaining = current.filter((f) => !toDismiss.has(f.path))
      if (remaining.length > 0) {
        await writeFile(unresolvedFilesPath, JSON.stringify(remaining))
      } else {
        await unlink(unresolvedFilesPath).catch(() => undefined)
      }
    } else {
      await unlink(unresolvedFilesPath).catch(() => undefined)
    }
  }
}
