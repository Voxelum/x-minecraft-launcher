import { InstallMarketOptionWithInstance, LockKey, ResourceState, SharedState, UpdateInstanceResourcesOptions, getInstanceModStateKey } from '@xmcl/runtime-api'
import { ensureDir, mkdir, stat, unlink } from 'fs-extra'
import { basename, join } from 'path'
import { LauncherApp } from '~/app'
import { InstanceService } from '~/instance'
import { kMarketProvider } from '~/market'
import { Resource, ResourceDomain } from '@xmcl/resource'
import { kResourceManager, kResourceWorker } from '~/resource'
import { AbstractService, ServiceStateManager } from '~/service'
import { isSystemError } from '@xmcl/utils'
import { linkDirectory, linkWithTimeoutOrCopy } from '../util/fs'
import { readlinkSafe } from './utils/readLinkSafe'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { CurseforgeApiError, CurseforgeV1Client } from '@xmcl/curseforge'

function getMigrateLegacy(domain: ResourceDomain) {
  if (domain === ResourceDomain.ResourcePacks || domain === ResourceDomain.ShaderPacks) {
    return async (instancePath: string) => {
      const destPath = join(instancePath, domain)
      const linkedPath = await readlinkSafe(destPath)
      if (linkedPath) {
        await unlink(destPath)
        await mkdir(destPath)
      }
    }
  }
  return (_: string) => Promise.resolve()
}

export abstract class AbstractInstanceDomainService extends AbstractService {
  onMigrateLegacy: (instancePath: string) => Promise<void>

  constructor(app: LauncherApp, protected domain: ResourceDomain) {
    super(app)
    this.onMigrateLegacy = getMigrateLegacy(domain)
  }

  async install({ files, path }: UpdateInstanceResourcesOptions) {
    this.log(`Install ${files.length} to ${path}/${this.domain}`)
    const dir = join(path, this.domain)
    return await Promise.all(files.map(async (src) => {
      const dest = join(dir, basename(src))
      if (src === dest) {
        return dest
      }
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest).catch(() => undefined)])

      try {
        if (!destStat) {
          if (srcStat.isDirectory()) {
            await linkDirectory(src, dest, this.logger)
          } else {
            await linkWithTimeoutOrCopy(src, dest)
          }
        } else if (srcStat.ino !== destStat.ino) {
          await unlink(dest).then(() => linkWithTimeoutOrCopy(src, dest))
        }
        return dest
      } catch (e) {
        if (isSystemError(e)) {
          Object.assign(e, {
            name: 'ResourceInstallError',
            domain: this.domain,
          })
        }
        throw e
      }
    }))
  }

  async uninstall({ files, path }: UpdateInstanceResourcesOptions) {
    let hasError = false
    await Promise.all(files.map(async (f) => {
      const dest = join(path, this.domain, basename(f))
      await unlink(dest).catch(() => { 
        hasError = true
      })
    }))
    if (hasError) {
      const key = `instance-${this.domain}://${path}`
      const stateManager = await this.app.registry.get(ServiceStateManager)
      stateManager.revalidate(key)
    }
  }

  async watch(instancePath: string) {
    const key = `instance-${this.domain}://${instancePath}`

    await this.onMigrateLegacy(instancePath)
    const resourceManager = await this.app.registry.get(kResourceManager)
    if (!resourceManager || !resourceManager.context) {
      throw new Error('ResourceManager is not properly initialized')
    }
    const store = await this.app.registry.get(ServiceStateManager)
    return store.registerOrGet(key, async ({ doAsyncOperation }) => {
      const lock = this.mutex.of(LockKey.instance(instancePath))
      const basePath = join(instancePath, this.domain)

      await ensureDir(basePath)
      const { dispose, revalidate, state } = resourceManager.watch({ directory: basePath, domain: this.domain, processUpdate: (func) => doAsyncOperation(lock.waitForUnlock().then(func)) })

      const instanceService = await this.app.registry.get(InstanceService)
      instanceService.registerRemoveHandler(instancePath, dispose)

      this.log(`Mounted on instance ${this.domain}: ${basePath}`)

      return [state, dispose, revalidate]
    })
  }

  async installFromMarket(options: InstallMarketOptionWithInstance): Promise<string[]> {
    const provider = await this.app.registry.get(kMarketProvider)
    const result = await provider.installInstanceFile({
      ...options,
      domain: this.domain,
      instancePath: options.instancePath,
    })
    return result.map((r) => r.path)
  }

  async showDirectory(path: string): Promise<void> {
    await this.app.shell.openDirectory(join(path, this.domain))
  }

  async refreshMetadata(instancePath: string): Promise<void> {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    const key = `instance-${this.domain}://${instancePath}`
    const state = stateManager.get<SharedState<ResourceState>>(key)
    const resourceManager = await this.app.registry.get(kResourceManager)
    this.logger.log(`Refresh metadata for instance ${this.domain} at ${instancePath}`)
    if (state) {
      await state.revalidate()
      const modrinthClient = await this.app.registry.getOrCreate(ModrinthV2Client)
      const curseforgeClient = await this.app.registry.getOrCreate(CurseforgeV1Client)
      const worker = await this.app.registry.getOrCreate(kResourceWorker)

      const onRefreshModrinth = async (all: Resource[]) => {
        try {
          const batchSize = 128
          for (let i = 0; i < all.length; i += batchSize) {
            const chunk = all.slice(i, i + batchSize)
            const versions = await modrinthClient.getProjectVersionsByHash(chunk.map(v => v.hash))
            const options = Object.entries(versions).map(([hash, version]) => {
              if (!hash) return undefined
              const f = chunk.find(f => f.hash === hash)
              if (f) return { hash: f.hash, metadata: { modrinth: { projectId: version.project_id, versionId: version.id } } }
              return undefined
            }).filter((v): v is any => !!v)
            if (options.length > 0) {
              this.log(`Update ${options.length} modrinth metadata for instance ${this.domain} at ${instancePath}`)
              await resourceManager.updateMetadata(options)
            } else {
              this.log(`No modrinth metadata to update for instance ${this.domain} at ${instancePath}`)
            }
          }
        } catch (e) {
          this.error(e as any)
        }
      }
      const onRefreshCurseforge = async (all: Resource[]) => {
        try {
          const chunkSize = 8
          const allChunks = [] as Resource[][]
          all = all.filter(a => !!a.hash && !a.isDirectory)
          for (let i = 0; i < all.length; i += chunkSize) {
            allChunks.push(all.slice(i, i + chunkSize))
          }

          const allPrints: Record<number, Resource> = {}
          for (const chunk of allChunks) {
            const prints = (await Promise.all(chunk.map(async (v) => ({ fingerprint: await worker.fingerprint(v.path), file: v }))))
            for (const { fingerprint, file } of prints) {
              if (fingerprint in allPrints) {
                this.warn(new Error(`Duplicated fingerprint ${fingerprint} for ${file.path} and ${allPrints[fingerprint].path}`))
                continue
              }
              allPrints[fingerprint] = file
            }
          }
          const result = await curseforgeClient.getFingerprintsMatchesByGameId(432, Object.keys(allPrints).map(v => parseInt(v, 10))).catch((e) => {
            if (e instanceof CurseforgeApiError && e.status >= 400 && e.status < 500 && e.status !== 404) {
              this.error(e)
            }
            return { exactMatches: [] }
          })
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
            await resourceManager.updateMetadata(options)
            this.log(`Update ${options.length} curseforge metadata for instance ${this.domain} at ${instancePath}`)
          } else {
            this.log(`No curseforge metadata to update for instance ${this.domain} at ${instancePath}`)
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
      this.log(`Found ${refreshCurseforge.length} mods to refresh curseforge metadata, ${refreshModrinth.length} mods to refresh modrinth metadata for instance ${this.domain} at ${instancePath}`)
      await Promise.allSettled([
        refreshCurseforge.length > 0 ? onRefreshCurseforge(refreshCurseforge) : undefined,
        refreshModrinth.length > 0 ? onRefreshModrinth(refreshModrinth) : undefined,
      ])
    }
  }
}
