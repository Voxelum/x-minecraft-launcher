import { InstanceModsService as IInstanceModsService, ResourceService as IResourceService, InstallModsOptions, InstanceModUpdatePayload, InstanceModUpdatePayloadAction, InstanceModsServiceKey, InstanceModsState, LockKey, LockStatus, MutableState, PartialResourceHash, Resource, ResourceDomain, getInstanceModStateKey, isModResource } from '@xmcl/runtime-api'
import { emptyDir, ensureDir, rename, stat, unlink } from 'fs-extra'
import debounce from 'lodash.debounce'
import watch from 'node-watch'
import { dirname, join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { kResourceWorker, ResourceService } from '~/resource'
import { shouldIgnoreFile } from '~/resource/core/pathUtils'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { AnyError, isSystemError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { AggregateExecutor, WorkerQueue } from '../util/aggregator'
import { linkWithTimeoutOrCopy, readdirIfPresent } from '../util/fs'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { CurseforgeV1Client } from '@xmcl/curseforge'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
@ExposeServiceKey(InstanceModsServiceKey)
export class InstanceModsService extends AbstractService implements IInstanceModsService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)

    this.resourceService.registerInstaller(ResourceDomain.Mods, async (resource, instancePath) => {
      await this.install({
        mods: [resource],
        path: instancePath,
      })
    })
  }

  async refreshMetadata(instancePath: string): Promise<void> {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    const state: MutableState<InstanceModsState> | undefined = await stateManager.get(getInstanceModStateKey(instancePath))
    if (state) {
      await state.revalidate()
      const modrinthClient = await this.app.registry.getOrCreate(ModrinthV2Client)
      const curseforgeClient = await this.app.registry.getOrCreate(CurseforgeV1Client)
      const worker = await this.app.registry.getOrCreate(kResourceWorker)

      const onRefreshModrinth = async (all: Resource[]) => {
        try {
          const versions = await modrinthClient.getProjectVersionsByHash(all.map(v => v.hash))
          const options = Object.entries(versions).map(([hash, version]) => {
            const f = all.find(f => f.hash === hash)
            if (f) return { hash: f.hash, metadata: { modrinth: { projectId: version.project_id, versionId: version.id } } }
            return undefined
          }).filter((v): v is any => !!v)
          if (options.length > 0) {
            await this.resourceService.updateResources(options)
            state.instanceModUpdates([[options, InstanceModUpdatePayloadAction.Update]])
          }
        } catch (e) {
          this.error(e as any)
        }
      }
      const onRefreshCurseforge = async (all: Resource[]) => {
        try {
          const chunkSize = 8
          const allChunks = [] as Resource[][]
          for (let i = 0; i < all.length; i += chunkSize) {
            allChunks.push(all.slice(i, i + chunkSize))
          }

          const allPrints: Record<number, Resource> = {}
          for (const chunk of allChunks) {
            const prints = (await Promise.all(chunk.map(async (v) => ({ fingerprint: await worker.fingerprint(v.path), file: v }))))
            for (const { fingerprint, file } of prints) {
              if (fingerprint in allPrints) {
                this.error(new Error(`Duplicated fingerprint ${fingerprint} for ${file.path} and ${allPrints[fingerprint].path}`))
                continue
              }
              allPrints[fingerprint] = file
            }
          }
          const result = await curseforgeClient.getFingerprintsMatchesByGameId(432, Object.keys(allPrints).map(v => parseInt(v, 10)))
          const options = [] as { hash: string; metadata: { curseforge: { projectId: number; fileId: number } } }[]
          for (const f of result.exactMatches) {
            const r = allPrints[f.file.fileFingerprint] || Object.values(allPrints).find(v => v.hash === f.file.hashes.find(a => a.algo === 1)?.value)
            if (r) {
              r.metadata.curseforge = { projectId: f.file.modId, fileId: f.file.id }
              options.push({
                hash: r.hash,
                metadata: {
                  curseforge: { projectId: f.file.modId, fileId: f.file.id },
                },
              })
            }
          }

          if (options.length > 0) {
            await this.resourceService.updateResources(options)
            state.instanceModUpdates([[options, InstanceModUpdatePayloadAction.Update]])
          }
        } catch (e) {
          this.error(e as any)
        }
      }

      const refreshCurseforge: Resource[] = []
      const refreshModrinth: Resource[] = []
      for (const mod of state.mods.filter(v => !v.metadata.curseforge || !v.metadata.modrinth)) {
        if (!mod.metadata.curseforge) {
          refreshCurseforge.push(mod)
        }
        if (!mod.metadata.modrinth) {
          refreshModrinth.push(mod)
        }
      }
      await Promise.allSettled([
        refreshCurseforge.length > 0 ? onRefreshCurseforge(refreshCurseforge) : undefined,
        refreshModrinth.length > 0 ? onRefreshModrinth(refreshModrinth) : undefined,
      ])
    }
  }

  async showDirectory(path: string): Promise<void> {
    await this.app.shell.openDirectory(join(path, 'mods'))
  }

  async watch(instancePath: string): Promise<MutableState<InstanceModsState>> {
    if (!instancePath) throw new AnyError('WatchModError', 'Cannot watch instance mods on empty path')
    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))
    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(getInstanceModStateKey(instancePath), async ({ defineAsyncOperation }) => {
      const updateModState = new AggregateExecutor<InstanceModUpdatePayload, InstanceModUpdatePayload[]>(v => v,
        (all) => {
          const badResources = [] as any[]
          for (const s of state.mods) {
            if (!s.path) {
              badResources.push(s)
            }
          }
          for (const [r, a] of all) {
            if (a === InstanceModUpdatePayloadAction.Remove || a === InstanceModUpdatePayloadAction.Upsert) {
              if (!r.path) {
                badResources.push(r)
              }
            }
          }
          state.instanceModUpdates(all)
          if (badResources.length > 0) {
            this.error(new AnyError('InstanceModUpdateError', 'Some resources are not valid', {}, { resources: badResources }))
          }
        },
        500)

      const workerQueue = new WorkerQueue<string>(defineAsyncOperation(async (filePath: string) => lock.read(async () => {
        const [resource] = await this.resourceService.importResources([{ path: filePath, domain: ResourceDomain.Mods }], true)
        if (resource && isModResource(resource)) {
          this.log(`Instance mod add ${filePath}`)
        } else {
          this.warn(`Non mod resource added in /mods directory! ${filePath}`)
        }
        if (resource) {
          updateModState.push([resource, InstanceModUpdatePayloadAction.Upsert])
        }
      })), 16, {
        retryCount: 7,
        shouldRetry: (e) => isSystemError(e) && (e.code === 'EMFILE' || e.code === 'EBUSY'),
        retryAwait: (retry) => Math.random() * 2000 + 1000,
      })

      workerQueue.onerror = (filePath, e) => {
        this.error(new AnyError('InstanceModAddError', `Fail to add instance mod ${filePath}`, { cause: e }))
      }

      const state = new InstanceModsState()
      const basePath = join(instancePath, 'mods')

      const processRemove = (filePath: string) => {
        const target = state.mods.find(r => r.path === filePath)
        if (target) {
          this.log(`Instance mod remove ${filePath}`)
          updateModState.push([target, InstanceModUpdatePayloadAction.Remove])
        } else {
          this.warn(`Cannot remove the mod ${filePath} as it's not found in memory cache!`)
        }
      }
      const revalidate = () => lock.read(async () => {
        const files = await readdirIfPresent(basePath)
        const expectFiles = files.filter((file) => !shouldIgnoreFile(file)).map((file) => join(basePath, file))
        const current = state.mods.length
        // Find differences
        const currentFiles = state.mods.map(r => r.path)
        const added = expectFiles.filter(f => !currentFiles.includes(f))
        const removed = currentFiles.filter(f => !expectFiles.includes(f))
        if (current !== expectFiles.length || added.length > 0 || removed.length > 0) {
          this.log(`Instance mods count mismatch: ${current} vs ${expectFiles.length}`)
          if (added.length > 0) {
            this.log(`Instance mods added: ${added.length}`)
            for (const f of added) { workerQueue.push(f) }
          }
          if (removed.length > 0) {
            this.log(`Instance mods removed: ${removed.length}`)
            for (const f of removed) { processRemove(f) }
          }
        }
      })

      const listener = this.resourceService as IResourceService
      const onResourceUpdate = (res: PartialResourceHash[]) => {
        if (res) {
          updateModState.push([res, InstanceModUpdatePayloadAction.Update])
        } else {
          this.error(new AnyError('InstanceModUpdateError', 'Cannot update instance mods as the resource is empty'))
        }
      }
      listener
        .on('resourceUpdate', onResourceUpdate)

      await ensureDir(basePath)
      await this.resourceService.whenReady(ResourceDomain.Mods)

      const scan = async (dir: string) => {
        const files = (await readdirIfPresent(dir))
          .filter((file) => !shouldIgnoreFile(file))
          .map((file) => join(dir, file))

        for (const file of files) {
          workerQueue.push(file)
        }

        return []
      }
      state.mods = await lock.read(() => scan(basePath))

      let events = 0
      const watcher = watch(basePath, async (event, filePath) => {
        if (shouldIgnoreFile(filePath) || filePath === basePath) return

        events++
        debouncedRevalidate()

        if (event === 'update') {
          workerQueue.push(filePath)
        } else {
          processRemove(filePath)
        }
      })

      const debouncedRevalidate = debounce(() => {
        if (events > 10) {
          revalidate()
        }
        events = 0
      }, 500)

      watcher.on('close', () => {
        this.log(`Unwatch on instance mods: ${basePath}`)
      })

      this.log(`Mounted on instance mods: ${basePath}`)

      return [state, () => {
        watcher.close()
        workerQueue.dispose()
        listener.removeListener('resourceAdd', onResourceUpdate)
          .removeListener('resourceUpdate', onResourceUpdate)
      }, revalidate]
    })
  }

  async install({ mods: resources, path }: InstallModsOptions) {
    const promises: Promise<void>[] = []
    this.log(`Install ${resources.length} to ${path}/mods`)
    for (const res of resources) {
      if (res.domain !== ResourceDomain.Mods) {
        this.warn(`Install non mod resource ${res.name} as it's not a mod`)
      }
      const src = res.storedPath || res.path
      const dest = join(path, ResourceDomain.Mods, res.fileName)
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest).catch(() => undefined)])

      let promise: Promise<any> | undefined
      if (!destStat) {
        promise = linkWithTimeoutOrCopy(src, dest)
      } else if (srcStat.ino !== destStat.ino) {
        promise = unlink(dest).then(() => linkWithTimeoutOrCopy(src, dest))
      }
      if (promise) {
        promises.push(promise.catch((e) => {
          this.error(new Error(`Cannot deploy the resource from ${src} to ${dest}`, { cause: e }))
          throw e
        }))
      }
    }
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  async enable({ mods, path }: InstallModsOptions): Promise<void> {
    this.log(`Enable ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      if (dirname(resource.path) !== instanceModsDir) {
        this.warn(`Skip to enable unmanaged mod file on ${resource.path}!`)
      } else if (!resource.path.endsWith('.disabled')) {
        this.warn(`Skip to enable enabled mod file on ${resource.path}!`)
      } else {
        promises.push(rename(resource.path, resource.path.substring(0, resource.path.length - '.disabled'.length)).catch(e => {
          // if (e.code === 'ENOENT') {
          //   // Force remove
          //   this.state.instanceModRemove([resource])
          // }
        }))
      }
    }
    await Promise.all(promises)
  }

  async disable({ mods, path }: InstallModsOptions) {
    this.log(`Disable ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      if (dirname(resource.path) !== instanceModsDir) {
        this.warn(`Skip to disable unmanaged mod file on ${resource.path}!`)
      } else if (resource.path.endsWith('.disabled')) {
        this.warn(`Skip to disable disabled mod file on ${resource.path}!`)
      } else {
        promises.push(rename(resource.path, resource.path + '.disabled').catch(e => {
          this.warn(e)
          // if (e.code === 'ENOENT') {
          //   // Force remove
          //   this.state.instanceModRemove([resource])
          // }
        }))
      }
    }
    await Promise.all(promises)
  }

  async uninstall(options: InstallModsOptions) {
    const { mods, path } = options
    this.log(`Uninstall ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      // if (dirname(resource.path) !== instanceModsDir) {
      //   const founded = this.state.mods.find(m => m.ino === resource.ino) ??
      //     this.state.mods.find(m => m.hash === resource.hash)
      //   if (founded && founded.path !== resource.path) {
      //     const realPath = join(instanceModsDir, founded.fileName)
      //     if (existsSync(realPath)) {
      //       promises.push(unlink(realPath))
      //     } else {
      //       this.warn(`Skip to uninstall unmanaged mod file on ${resource.path}!`)
      //     }
      //   } else {
      //     this.warn(`Skip to uninstall unmanaged mod file on ${resource.path}!`)
      //   }
      // } else {
      promises.push(unlink(resource.path).catch(e => {
        // if (e.code === 'ENOENT') {
        //   // Force remove
        //   this.state.instanceModRemove([resource])
        // }
      }))
      // }
    }
    await Promise.all(promises)
    this.log(`Finish to uninstall ${mods.length} from ${path}`)
  }

  async installToServerInstance(options: InstallModsOptions): Promise<void> {
    const modsDir = join(options.path, 'server', 'mods')
    await ensureDir(modsDir)
    await emptyDir(modsDir)
    await this.install({ ...options, path: join(options.path, 'server') })
  }

  async getServerInstanceMods(path: string): Promise<Array<{ fileName: string; ino: number }>> {
    const result: Array<{ fileName: string; ino: number }> = []

    const modsDir = join(path, 'server', 'mods')
    const files = await readdirIfPresent(modsDir)
    for (const file of files) {
      const fstat = await stat(join(modsDir, file))
      result.push({ fileName: file, ino: fstat.ino })
    }

    return result
  }
}
