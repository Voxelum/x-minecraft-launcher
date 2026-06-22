import { CurseforgeV1Client } from '@xmcl/curseforge'
import {
  InstanceFileOperationHandler as InstanceFileOperationHandlerV2,
  InstanceInstallLock,
  InstanceLockSchema,
  computeFileUpdates,
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
  isUpstreamIsSameOrigin,
  type InstanceInstallService as IInstanceInstallService,
  type InstallFileError,
  type InstallInstanceOptions,
  type InstanceFileUpdate,
  type SharedState,
} from '@xmcl/runtime-api'
import { Tracker } from '@xmcl/installer'
import { AnyError, isSystemError } from '@xmcl/utils'
import { FSWatcher } from 'chokidar'
import filenamify from 'filenamify'
import { readFile, readJSON, readJson, unlink, writeFile, writeJson } from 'fs-extra'
import { basename, dirname, join, resolve } from 'path'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { ZipManager, kTasks, type Tasks } from '~/infra'
import { InstanceService } from '~/instance/InstanceService'
import { kDownloadOptions } from '~/network'
import { kPeerFacade } from '~/peer'
import { kResourceManager, kResourceWorker, type ResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { downloadInstanceFiles } from './utils/downloadInstanceFiles'
import { linkInstanceFiles } from './utils/linkInstanceFiles'
import { unzipInstanceFiles } from './utils/unzipInstanceFiles'
import { resolveInstanceFiles } from './utils/resolveInstanceFiles'
import { getTracker } from '~/util/taskHelper'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceInstallServiceKey)
export class InstanceInstallService extends AbstractService implements IInstanceInstallService {
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
    if (snapshot) {
      return snapshot.sha1
    }
    const newSnapshot = await this.resourceManager.getSnapshot(file)
    return newSnapshot.sha1
  }

  private getCrc32 = async (instancePath: string, file: File) => {
    return await this.worker.checksum(file.path, 'crc32')
  }

  async #getDelta(
    instancePath: string,
    lockState: InstanceLockSchema | undefined,
    newUpstream: InstanceUpstream,
    newFiles: InstanceFile[],
  ) {
    let fileDelta: InstanceFileUpdate[] = []
    const fs = { getFile, getSha1: this.getSha1, getCrc32: this.getCrc32, join }

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
  ) {
    const lockFilePath = join(instancePath, 'instance-lock.json')
    const currentStatePath = join(instancePath, '.install-profile')

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

    // Race fix: deleteInstance and #install used to take different
    // mutex keys, so `rm -rf <instance>` could run while our install
    // was still writing files (ENOENT/EPERM/EBUSY storm on
    // .install-profile / staging-dir rename). We now:
    //   1. Register a strong-ref abort callback so deleteInstance can
    //      cancel us fast (held to keep the closure alive — previously
    //      handlers were WeakRef'd and could be GC'd mid-install).
    //   2. Move every fs op into a single runExclusive on the same
    //      LockKey.instance(p) that deleteInstance now waits on.
    const instanceService = await this.app.registry.get(InstanceService)
    const abortOnRemove = () => task.controller.abort()
    const unregisterRemoveHandler = instanceService.registerRemoveHandler(
      instancePath,
      abortOnRemove,
    )

    const updateResources = async () => {
      try {
        if (resourceToUpdate.length > 0) {
          const options = await Promise.all(
            resourceToUpdate.map(async ({ hash, metadata, uris, destination }) => {
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

    try {
      await lock.runExclusive(async () => {
        task.controller.signal.throwIfAborted()

        // Persist pending-install marker INSIDE the lock so a
        // concurrent deleteInstance cannot rm the parent dir
        // mid-write (caller `installInstanceFiles` used to do this
        // unlocked, which is one of the ENOENT-on-.install-profile
        // shapes we saw in telemetry).
        await writeJson(currentStatePath, InstanceInstallLock.parse(targetState))

        const fileDelta: InstanceFileUpdate[] = await this.#getDelta(
          instancePath,
          lockState,
          targetState.upstream,
          targetState.files,
        )
        this.log('Instance install delta', fileDelta.length)
        task.controller.signal.throwIfAborted()

        // Update handler context with tracker
        const handlerWithTracker = new InstanceFileOperationHandlerV2(
          instancePath,
          new Set(targetState.finishedPath),
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
                destination: file.path,
              })
            },
            getCachedResource: (sha1) =>
              this.resourceManager
                .getSnapshotByHash(sha1)
                .then((r) => (r ? this.resourceManager.validateSnapshotFile(r) : undefined))
                .then((r) => r?.path),
            getPeerActualUrl: (url) =>
              this.app.registry
                .getIfPresent(kPeerFacade)
                .then((peers) => peers?.getHttpDownloadUrl(url)),
            unzipFiles: (payloads, finished, signal) =>
              unzipInstanceFiles(zipManager, payloads, finished, signal, tracker),
            downloadFiles: (payloads, finished, signal) =>
              downloadInstanceFiles(
                payloads.map((v) => ({
                  options: {
                    url: v.options.urls,
                    validator: v.options.sha1 ? { algorithm: 'sha1', hash: v.options.sha1 } : undefined,
                    destination: v.options.destination,
                    expectedTotal: v.options.size,
                  },
                  file: v.file,
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

        const runInstallTasks = async () => {
          try {
            const newAddedFiles = fileDelta
              .filter((f) => f.operation === 'add' || f.operation === 'backup-add')
              .map((f) => f.file)

            const hasUpdate = await resolveInstanceFiles(
              newAddedFiles,
              curseforgeClient,
              modrinthClient,
              task.controller.signal,
            )

            if (hasUpdate) {
              // save current state
              logger.log('Save current state due to refresh', instancePath)
              await writeJson(
                currentStatePath,
                InstanceInstallLock.parse({
                  ...targetState,
                  mtime: Date.now(),
                }),
              )
            }
          } catch {
            // Ignore
          }

          try {
            await handlerWithTracker.prepareInstallFiles(fileDelta, task.controller.signal)
            logger.log('Finished install tasks')
          } catch (e) {
            logger.warn('Install instance files error', e)
            // Guarded: if this writeJson itself fails (e.g. AV held
            // the file, ENOSPC) we MUST keep the original `e` —
            // previously the inner throw replaced it, which is why
            // production telemetry only ever saw the generic
            // "ENOENT open .install-profile" wrapper and never the
            // real cause (download/zip/network).
            await writeJson(
              currentStatePath,
              InstanceInstallLock.parse({
                ...targetState,
                finishedPath: Array.from(handlerWithTracker.finished),
                mtime: Date.now(),
              }),
            ).catch((writeErr) => {
              logger.warn('Failed to save partial install state', writeErr)
            })
            throw e
          }

          task.controller.signal.throwIfAborted()
          await handlerWithTracker.backupAndRename()

          await updateResources()
        }

        await runInstallTasks()

        task.controller.signal.throwIfAborted()

        // update the lock file
        if (!noLock) {
          await writeJson(
            lockFilePath,
            InstanceLockSchema.parse({
              version: 1,
              files: targetState.files,
              upstream: targetState.upstream,
              mtime: Date.now(),
            }),
          )
        }

        // remove the install lock
        await unlink(currentStatePath).catch(() => {
          /* ignored */
        })

        // Reconcile the unresolved-files list. Merge the freshly-computed
        // unresolvable files with the ones that were already pending from
        // earlier runs. Every file we attempted in THIS run
        // (targetState.files) is dropped from the existing list — those either
        // succeeded (no longer unresolved) or are re-added right below if they
        // failed again. Files that were not part of this run (e.g. a
        // partial/diff install that only resolved a subset) are preserved so
        // they are not silently lost.
        const unresolvedFilesPath = join(instancePath, 'unresolved-files.json')
        const attemptedPaths = new Set(targetState.files.map((f) => f.path))
        const existingUnresolved: InstanceFile[] = await readJSON(unresolvedFilesPath).catch(
          () => [],
        )
        const mergedUnresolved = existingUnresolved
          .filter((f) => !attemptedPaths.has(f.path))
          .concat(handlerWithTracker.unresolvable)
        if (mergedUnresolved.length > 0) {
          await writeFile(unresolvedFilesPath, JSON.stringify(mergedUnresolved))
        } else {
          await unlink(unresolvedFilesPath).catch(() => undefined)
        }
      })

      task.complete()
    } catch (e) {
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
      unregisterRemoveHandler()
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

    const fs = { getFile, getSha1: this.getSha1, getCrc32: this.getCrc32, join }
    return await computeFileUpdates(instancePath, options.oldFiles, options.files, Date.now(), fs)
  }

  async resumeInstanceInstall(
    instancePath: string,
    overrides?: InstanceFile[],
  ): Promise<void | InstallFileError[]> {
    const lockFilePath = join(instancePath, 'instance-lock.json')
    const lockState = await readJson(lockFilePath)
      .then(InstanceLockSchema.parse)
      .catch(() => undefined)

    const currentStatePath = join(instancePath, '.install-profile')
    const currentState = await readJson(currentStatePath)
      .then(InstanceInstallLock.parse)
      .catch(() => undefined)
    if (!currentState) {
      return
    }

    if (overrides) {
      currentState.files = currentState.files.map(
        (f) => overrides.find((o) => o.path === f.path) ?? f,
      )
    }

    try {
      return await this.#install(instancePath, lockState, currentState)
    } catch (e) {
      const isChecksumError = (
        err: unknown,
      ): err is Error & { file: string; expect: string; actual: string } =>
        err instanceof Error && err.name === 'ChecksumNotMatchError'

      if (e instanceof AggregateError) {
        if (e.errors.every(isChecksumError)) {
          return e.errors.map((err) => ({
            file: currentState.files.find((f) => f.path === resolve(instancePath, err.file))!,
            name: 'ChecksumNotMatchError' as const,
            expect: err.expect,
            actual: err.actual,
          }))
        }
      } else if (isChecksumError(e)) {
        const file = currentState.files.find((f) => f.path === resolve(instancePath, e.file))
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
        if (e instanceof Error && e.name === 'InstanceUpstreamError') {
          // remove profile
          unlink(join(instancePath, '.install-profile')).catch(() => {})
        } else if (isSystemError(e) && e.code === 'ENOENT') {
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
      const watcher = new FSWatcher({
        cwd: path,
        depth: 1,
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
          if (ev === 'add' || ev === 'change') {
            if (filePath === '.install-profile') {
              const currentStatePath = join(path, '.install-profile')
              const lock = await readFile(currentStatePath, 'utf-8').then(
                (content) => {
                  try {
                    if (content.trim().length === 0) {
                      return undefined
                    }
                    return JSON.parse(content) as InstanceInstallLock
                  } catch (e) {
                    Object.assign(e as any, {
                      content,
                    })
                    throw e
                  }
                },
                (e) => {
                  if (isSystemError(e) && e.code === 'ENOENT') {
                    return undefined
                  }
                  if (e.name === 'Error') {
                    e.name = 'InstanceInstallProfileError'
                  }
                  this.error(e)
                },
              )
              let count = 0
              if (lock?.files instanceof Array && lock.finishedPath instanceof Array) {
                count = lock.files.length - lock.finishedPath.length
              } else if (lock?.files instanceof Array) {
                count = lock.files.length
              }
              status.pendingFileCountSet(count || 0)
            } else if (filePath === 'unresolved-files.json') {
              const unresolvedFilesPath = join(path, 'unresolved-files.json')
              const unresolvedFiles = await readJSON(unresolvedFilesPath).catch(() => [])
              status.unresolvedFilesSet(unresolvedFiles)
            }
          } else if (ev === 'unlink') {
            if (filePath === '.install-profile') {
              status.pendingFileCountSet(0)
            } else if (filePath === 'unresolved-files.json') {
              status.unresolvedFilesSet([])
            }
          }
        })
        .add('.install-profile')
        .add('unresolved-files.json')

      return [
        status,
        () => {
          watcher.close()
        },
      ]
    })
  }

  async installInstanceFiles(options: InstallInstanceOptions): Promise<void> {
    const { path: instancePath, files, id } = options

    const timestamp = Date.now()
    this.log('Install instance files', instancePath, id)

    if ('upstream' in options) {
      const upstream = options.upstream
      const lockFilePath = join(instancePath, 'instance-lock.json')
      /**
       * Lock file represent the previous install.
       */
      const lockState = await readJson(lockFilePath)
        .then(InstanceLockSchema.parse)
        .catch(() => undefined)

      const instanceDir = dirname(instancePath)
      const instanceName = basename(instancePath)
      const currentState: InstanceInstallLock = {
        version: 0,
        files,
        upstream,
        mtime: timestamp,
        backup: join(
          instancePath,
          '.backups',
          filenamify(new Date().toLocaleString(), { replacement: '-' }),
        ),
        workspace: join(instanceDir, `.${instanceName}-install-${timestamp}`),
        finishedPath: [],
      }

      // Note: the .install-profile marker is now written by #install
      // INSIDE its instance-lock critical section, so a concurrent
      // deleteInstance cannot rm the parent directory mid-write.

      this.log('Install instance files with lock', !!lockState)
      return this.#install(instancePath, lockState, currentState, id).catch((e) => {
        if (e.name === 'InstanceUpstreamError') {
          // remove profile
          unlink(join(instancePath, '.install-profile')).catch(() => {})
        }
        throw e
      })
    } else {
      const oldFiles = options.oldFiles
      const files = options.files
      const instanceDir = dirname(instancePath)
      const instanceName = basename(instancePath)

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
          filenamify(new Date().toLocaleString(), { replacement: '-' }),
        ),
        workspace: join(instanceDir, `.${instanceName}-install-${id ?? timestamp}`),
        finishedPath: [],
      }

      this.log('Install instance files with diff')
      return this.#install(instancePath, lockState, currentState, id, true)
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
