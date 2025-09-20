import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ChecksumNotMatchError } from '@xmcl/file-transfer'
import { InstanceFileOperationHandler as InstanceFileOperationHandlerV2, computeFileUpdates, type InstanceFile, type InstanceUpstream } from '@xmcl/instance'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { ResourceManager, getDomainedPath, getFile, type File, type ResourceMetadata } from '@xmcl/resource'
import { InstanceInstallLockSchema, InstanceInstallServiceKey, InstanceInstallStatus, InstanceLockSchema, LockKey, isUpstreamIsSameOrigin, type InstanceInstallService as IInstanceInstallService, type InstallFileError, type InstallInstanceOptions, type InstanceFileUpdate, type SharedState } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { AnyError, isSystemError } from '@xmcl/utils'
import { FSWatcher } from 'chokidar'
import filenamify from 'filenamify'
import { readFile, readJSON, unlink, writeFile } from 'fs-extra'
import { basename, dirname, join, resolve } from 'path'
import { Inject, LauncherApp, LauncherAppKey } from '~/app'
import { ZipManager, kTaskExecutor, type TaskFn } from '~/infra'
import { InstanceService } from '~/instance/InstanceService'
import { kDownloadOptions } from '~/network'
import { kPeerFacade } from '~/peer'
import { kResourceWorker, type ResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { createSafeIO } from '~/util/persistance'
import { UnzipFileTask } from './UnzipFileTask'
import { InstanceFileDownloadTask } from './utils/InstanceFileDownloadTask'
import { InstanceFileOperationTask } from './utils/InstanceFileOperationTask'
import { ResolveInstanceFileTask } from './utils/ResolveInstanceFileTask'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
@ExposeServiceKey(InstanceInstallServiceKey)
export class InstanceInstallService extends AbstractService implements IInstanceInstallService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceManager) private resourceManager: ResourceManager,
    @Inject(kTaskExecutor) private submit: TaskFn,
    @Inject(kResourceWorker) private worker: ResourceWorker,
    @Inject(CurseforgeV1Client) private curseforgeClient: CurseforgeV1Client,
    @Inject(ModrinthV2Client) private modrinthClient: ModrinthV2Client,
  ) {
    super(app)
  }

  #lockFile = createSafeIO(InstanceLockSchema, this)
  #installLockFile = createSafeIO(InstanceInstallLockSchema, this)

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
        const hash = await resourceManager.getHashByUri(`modrinth:${upstream.projectId}:${upstream.versionId}`)
        if (hash) {
          metadata = await resourceManager.getMetadataByHash(hash)
        }
      }
      if (metadata) {
        if (metadata.instance) {
          return {
            version: 1,
            upstream,
            files: metadata.instance.files
          }
        }
      }
    }
    if (upstream.type === 'curseforge-modpack') {
      let metadata: ResourceMetadata | undefined
      if (upstream.sha1) {
        metadata = await resourceManager.getMetadataByHash(upstream.sha1)
      } else {
        const hash = await resourceManager.getHashByUri(`curseforge:${upstream.modId}:${upstream.fileId}`)
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
    const snapshot = await this.resourceManager.getSnapshotByDomainedPath(getDomainedPath(file.path, instancePath))
    if (snapshot) {
      return snapshot.sha1
    }
    const newSnapshot = await this.resourceManager.getSnapshot(file)
    return newSnapshot.sha1
  }

  private getCrc32 = async (instancePath: string, file: File) => {
    return await this.worker.checksum(file.path, 'crc32')
  }

  async #getDelta(instancePath: string, lockState: InstanceLockSchema | undefined, newUpstream: InstanceUpstream, newFiles: InstanceFile[]) {
    let fileDelta: InstanceFileUpdate[] = []
    const fs = { getFile, getSha1: this.getSha1, getCrc32: this.getCrc32, join }

    if (lockState) {
      // check if upstream are the same
      if (isUpstreamIsSameOrigin(newUpstream, lockState.upstream)) {
        fileDelta = await computeFileUpdates(instancePath, lockState.files, newFiles, lockState.mtime, fs)
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

  async #install(instancePath: string, lockState: InstanceLockSchema | undefined, targetState: InstanceInstallLockSchema, id?: string, noLock?: boolean) {
    const lockFilePath = join(instancePath, 'instance-lock.json')
    const currentStatePath = join(instancePath, '.install-profile')
    const installLockFileIO = this.#installLockFile

    const fileDelta: InstanceFileUpdate[] = await this.#getDelta(instancePath, lockState, targetState.upstream, targetState.files)
    this.log('Instance install delta', fileDelta.length)

    const curseforgeClient = this.curseforgeClient
    const modrinthClient = this.modrinthClient
    const zipManager = await this.app.registry.getOrCreate(ZipManager)
    const resourceToUpdate: Array<{ hash: string; metadata: ResourceMetadata; uris: string[]; destination: string }> = []
    const downloadOptions = await this.app.registry.get(kDownloadOptions)

    const handler = new InstanceFileOperationHandlerV2(
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
        getCachedResource: (sha1) => this.resourceManager.getSnapshotByHash(sha1).then(r => r ? this.resourceManager.validateSnapshotFile(r) : undefined)
          .then(r => r?.path),
        getPeerActualUrl: (url) => this.app.registry.getIfPresent(kPeerFacade).then(peers => peers?.getHttpDownloadUrl(url)),
        getUnzipTask: (payloads, finished) => new UnzipFileTask(zipManager, payloads, finished),
        getDownloadTask: (payloads, finished) => new InstanceFileDownloadTask(payloads.map(v => ({
          options: {
            ...downloadOptions,
            url: v.options.urls,
            validator: v.options.sha1 ? { algorithm: 'sha1', hash: v.options.sha1 } : undefined,
            destination: v.options.destination,
            expectedTotal: v.options.size,
          },
          file: v.file,
        })), finished),
        getFileOperationTask: (payloads, finished, unhandled) => new InstanceFileOperationTask(payloads, this.app.platform, finished, unhandled),
      },
    )

    const lock = this.mutex.of(LockKey.instance(instancePath))
    const logger = this

    const updateInstanceTask = task('installInstance', async function () {
      await lock.runExclusive(async () => {
        try {
          const newAddedFiles = fileDelta.filter(f => f.operation === 'add' || f.operation === 'backup-add').map(f => f.file)
          const hasUpdate = await this.yield(new ResolveInstanceFileTask(newAddedFiles, curseforgeClient, modrinthClient))

          if (hasUpdate) {
            // save current state
            logger.log('Save current state due to refresh', instancePath)
            await installLockFileIO.write(currentStatePath, {
              ...targetState,
              mtime: Date.now(),
            })
          }
        } catch {
          // Ignore
        }

        try {
          for await (const tasks of handler.prepareInstallFilesTasks(fileDelta)) {
            await this.all(tasks, { throwErrorImmediately: false })
            logger.log(`Finished [${tasks.map(t => t.name).join(', ')}] tasks`)
          }
        } catch (e) {
          logger.warn('Install instance files error', e)
          await installLockFileIO.write(currentStatePath, {
            ...targetState,
            finishedPath: Array.from(handler.finished),
            mtime: Date.now(),
          })
          throw e
        }

        await handler.backupAndRename()

        // await handler.updateResourceMetadata(modrinthClient)
      })
    }, { instance: instancePath, id })

    try {
      await this.submit(updateInstanceTask)

      // update the lock file
      if (!noLock) {
        await this.#lockFile.write(lockFilePath, {
          version: 1,
          files: targetState.files,
          upstream: targetState.upstream,
          mtime: Date.now(),
        })
      }

      // remove the install lock
      await unlink(currentStatePath).catch(() => {/* ignored */ })

      if (handler.unresolvable.length > 0) {
        await writeFile(join(instancePath, 'unresolved-files.json'), JSON.stringify(handler.unresolvable))
      }
    } catch (e) {
      throw Object.assign(e as any, {
        name: (e as any).name === 'Error' ? 'InstallInstanceFilesError' : (e as any).name,
        installInstance: {
          instancePath,
        },
      })
    }
  }

  async previewInstanceFiles(options: InstallInstanceOptions): Promise<InstanceFileUpdate[]> {
    const { path: instancePath } = options
    const lockFilePath = join(instancePath, 'instance-lock.json')
    const lockState = await this.#lockFile.readIfExists(lockFilePath)

    if ('upstream' in options) {
      const delta = await this.#getDelta(instancePath, lockState, options.upstream, options.files)
      return delta
    }

    const fs = { getFile, getSha1: this.getSha1, getCrc32: this.getCrc32, join }
    return await computeFileUpdates(instancePath, options.oldFiles, options.files, Date.now(), fs)
  }

  async resumeInstanceInstall(instancePath: string, overrides?: InstanceFile[]): Promise<void | InstallFileError[]> {
    const lockFilePath = join(instancePath, 'instance-lock.json')
    const lockState = await this.#lockFile.readIfExists(lockFilePath)

    const currentStatePath = join(instancePath, '.install-profile')
    const currentState = await this.#installLockFile.readIfExists(currentStatePath)

    if (!currentState) {
      return
    }

    if (overrides) {
      currentState.files = currentState.files.map(f => overrides.find(o => o.path === f.path) ?? f)
    }

    try {
      return await this.#install(instancePath, lockState, currentState)
    } catch (e) {
      if (e instanceof AggregateError) {
        if (e.errors.every(e => e instanceof ChecksumNotMatchError)) {
          return e.errors.map(e => ({
            file: currentState.files.find(f => f.path === resolve(instancePath, e.file))!,
            name: 'ChecksumNotMatchError',
            expect: e.expect,
            actual: e.actual,
          }))
        }
      } else if (e instanceof ChecksumNotMatchError) {
        const file = currentState.files.find(f => f.path === resolve(instancePath, e.file))
        if (file) {
          return [{
            file: file,
            name: 'ChecksumNotMatchError',
            expect: e.expect,
            actual: e.actual,
          }]
        }
      } else {
        if (e instanceof Error && e.name === 'InstanceUpstreamError') {
          // remove profile
          unlink(join(instancePath, '.install-profile')).catch(() => { })
        } else if (isSystemError(e) && e.code === 'ENOENT') {
          const path = e.path
          if (path) {
            const zipFileIsMissing = currentState.files.find(f => f.downloads && f.downloads.some(d => d.startsWith('zip://') && d.includes(path)))
            if (zipFileIsMissing) {
              return [{
                file: path,
                name: 'UnpackZipFileNotFoundError',
              }]
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
        .on('all', async (ev, filePath) => {
          if (ev === 'add' || ev === 'change') {
            if (filePath === '.install-profile') {
              const currentStatePath = join(path, '.install-profile')
              const lock = await readFile(currentStatePath, 'utf-8').then((content) => {
                try {
                  if (content.trim().length === 0) {
                    return undefined
                  }
                  return JSON.parse(content) as InstanceInstallLockSchema
                } catch (e) {
                  Object.assign((e as any), {
                    content,
                  })
                  throw e
                }
              }, (e) => {
                if (isSystemError(e) && e.code === 'ENOENT') {
                  return undefined
                }
                if (e.name === 'Error') {
                  e.name = 'InstanceInstallProfileError'
                }
                this.error(e)
              })
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

      return [status, () => {
        watcher.close()
      }]
    })
  }

  async installInstanceFiles(options: InstallInstanceOptions): Promise<void> {
    const {
      path: instancePath,
      files,
      id,
    } = options

    const timestamp = Date.now()
    this.log('Install instance files', instancePath, id)

    if ('upstream' in options) {
      const upstream = options.upstream
      const lockFilePath = join(instancePath, 'instance-lock.json')
      /**
       * Lock file represent the previous install.
       */
      const lockState = await this.#lockFile.readIfExists(lockFilePath)

      const pendingInstallPath = join(instancePath, '.install-profile')

      const instanceDir = dirname(instancePath)
      const instanceName = basename(instancePath)
      const currentState: InstanceInstallLockSchema = {
        version: 0,
        files,
        upstream,
        mtime: timestamp,
        backup: join(instancePath, '.backups', filenamify(new Date().toLocaleString(), { replacement: '-' })),
        workspace: join(instanceDir, `.${instanceName}-install-${timestamp}`),
        finishedPath: [],
      }

      // save current state
      await this.#installLockFile.write(pendingInstallPath, currentState)

      this.log('Install instance files with lock', !!lockState)
      return this.#install(instancePath, lockState, currentState, id).catch((e) => {
        if (e.name === 'InstanceUpstreamError') {
          // remove profile
          unlink(join(instancePath, '.install-profile')).catch(() => { })
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

      const currentState: InstanceInstallLockSchema = {
        version: 1,
        files,
        upstream: {
          type: 'peer',
          id: '',
        },
        mtime: timestamp,
        backup: join(instancePath, '.backups', filenamify(new Date().toLocaleString(), { replacement: '-' })),
        workspace: join(instanceDir, `.${instanceName}-install-${id ?? timestamp}`),
        finishedPath: [],
      }

      this.log('Install instance files with diff')
      return this.#install(instancePath, lockState, currentState, id, true)
    }
  }

  async dismissUnresolvedFiles(path: string): Promise<void> {
    await unlink(join(path, 'unresolved-files.json')).catch(() => undefined)
  }
}
