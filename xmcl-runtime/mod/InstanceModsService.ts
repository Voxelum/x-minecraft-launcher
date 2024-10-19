import { CurseforgeV1Client } from '@xmcl/curseforge'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { InstanceModsService as IInstanceModsService, InstallMarketOptionWithInstance, InstallModsOptions, InstanceModsServiceKey, ResourceState, LockKey, MutableState, Resource, ResourceDomain, getInstanceModStateKey } from '@xmcl/runtime-api'
import { emptyDir, ensureDir, rename, stat, unlink } from 'fs-extra'
import { basename, dirname, join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { kMarketProvider } from '~/market'
import { ResourceManager, kResourceWorker } from '~/resource'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { AnyError, isSystemError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { linkWithTimeoutOrCopy, readdirIfPresent } from '../util/fs'
import { InstanceService } from '~/instance'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
@ExposeServiceKey(InstanceModsServiceKey)
export class InstanceModsService extends AbstractService implements IInstanceModsService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceManager) private resourceManager: ResourceManager,
  ) {
    super(app)
  }

  async refreshMetadata(instancePath: string): Promise<void> {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    const state = stateManager.get<MutableState<ResourceState>>(getInstanceModStateKey(instancePath))
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
            await this.resourceManager.updateMetadata(options)
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
            await this.resourceManager.updateMetadata(options)
          }
        } catch (e) {
          this.error(e as any)
        }
      }

      const refreshCurseforge: Resource[] = []
      const refreshModrinth: Resource[] = []
      for (const mod of state.files.filter(v => !v.metadata.curseforge || !v.metadata.modrinth)) {
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

  async watch(instancePath: string): Promise<MutableState<ResourceState>> {
    if (!instancePath) throw new AnyError('WatchModError', 'Cannot watch instance mods on empty path')
    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))
    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(getInstanceModStateKey(instancePath), async ({ doAsyncOperation }) => {
      const basePath = join(instancePath, 'mods')

      await ensureDir(basePath)
      const { dispose, revalidate, state } = this.resourceManager.watch(basePath, ResourceDomain.Mods, (func) => doAsyncOperation(lock.read(func)))

      const instanceService = await this.app.registry.get(InstanceService)
      instanceService.registerRemoveHandler(instancePath, dispose)

      this.log(`Mounted on instance mods: ${basePath}`)

      return [state, dispose, revalidate]
    })
  }

  async installFromMarket(options: InstallMarketOptionWithInstance): Promise<string[]> {
    const provider = await this.app.registry.get(kMarketProvider)
    const result = await provider.installFile({
      ...options,
      directory: join(options.instancePath, 'mods'),
    })
    return result.map(v => v.path)
  }

  async install({ mods: resources, path }: InstallModsOptions) {
    const promises: Promise<void>[] = []
    this.log(`Install ${resources.length} to ${path}/mods`)
    for (const res of resources) {
      const src = res
      const dest = join(path, ResourceDomain.Mods, basename(res))
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
      if (dirname(resource) !== instanceModsDir) {
        this.warn(`Skip to enable unmanaged mod file on ${resource}!`)
      } else if (!resource.endsWith('.disabled')) {
        this.warn(`Skip to enable enabled mod file on ${resource}!`)
      } else {
        promises.push(rename(resource, resource.substring(0, resource.length - '.disabled'.length)).catch(e => {
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
      if (dirname(resource) !== instanceModsDir) {
        this.warn(`Skip to disable unmanaged mod file on ${resource}!`)
      } else if (resource.endsWith('.disabled')) {
        this.warn(`Skip to disable disabled mod file on ${resource}!`)
      } else {
        promises.push(rename(resource, resource + '.disabled').catch(e => {
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
      if (dirname(resource) !== instanceModsDir) {
        continue
      }
      promises.push(unlink(resource).catch(e => {
        // if (e.code === 'ENOENT') {
        //   // Force remove
        //   this.state.instanceModRemove([resource])
        // }
      }))
    }
    await Promise.all(promises)
    this.log(`Finish to uninstall ${mods.length} from ${path}`)
  }

  async installToServerInstance(options: InstallModsOptions): Promise<void> {
    this.log(`Install ${options.mods.length} mods to server instance at ${options.path}`)
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

  async searchInstalled(keyword: string): Promise<Resource[]> {
    return await this.resourceManager.getResourcesByKeyword(keyword, 'mods/')
  }
}
