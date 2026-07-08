import { InstallMarketOptionWithInstance, LockKey, ResourceState, SharedState, UpdateInstanceResourcesOptions, getInstanceModStateKey } from '@xmcl/runtime-api'
import { ensureDir, mkdir, readdir, rename, rm, stat, unlink } from 'fs-extra'
import { basename, extname, join } from 'path'
import { kGameDataPath, LauncherApp } from '~/app'
import { InstanceService } from '~/instance'
import { kMarketProvider } from '~/market'
import { Resource, ResourceDomain, UpdateResourcePayload } from '@xmcl/resource'
import { kResourceManager, kResourceWorker } from '~/resource'
import { AbstractService, ServiceStateManager } from '~/service'
import { isSystemError } from '@xmcl/utils'
import { linkDirectory, linkOrCopyDirectory, linkWithTimeoutOrCopy, missing } from '../util/fs'
import { readlinkSafe, isLinkTo, normalizeLinkTarget } from './utils/readLinkSafe'
import { ModrinthV2Client } from '@xmcl/modrinth'
import { CurseforgeApiError, CurseforgeV1Client } from '@xmcl/curseforge'

export abstract class AbstractInstanceDomainService extends AbstractService {
  constructor(app: LauncherApp, protected domain: ResourceDomain) {
    super(app)
  }

  /**
   * Get the global (shared) folder for this domain, e.g. `<gameData>/resourcepacks`.
   */
  protected async getSharedDirectory() {
    const getPath = await this.app.registry.get(kGameDataPath)
    return getPath(this.domain)
  }

  /**
   * Legacy migration hook run on every `watch`.
   *
   * Historically the `resourcepacks`/`shaderpacks` folder could be a stale
   * symlink to an obsolete location. Those are removed and replaced by a real
   * directory. A link that intentionally points at the current global shared
   * folder (created by {@link linkShared}) is preserved.
   */
  async onMigrateLegacy(instancePath: string): Promise<void> {
    if (this.domain !== ResourceDomain.ResourcePacks && this.domain !== ResourceDomain.ShaderPacks) {
      return
    }
    const destPath = join(instancePath, this.domain)
    const linkedPath = await readlinkSafe(destPath).catch(() => '')
    if (linkedPath) {
      const shared = await this.getSharedDirectory()
      // Preserve an intentional link to the global shared folder.
      if (normalizeLinkTarget(linkedPath) === normalizeLinkTarget(shared)) {
        return
      }
      await unlink(destPath)
      await mkdir(destPath)
    }
  }

  /**
   * Whether the instance's domain folder is soft-linked to the global shared folder.
   */
  async isLinked(instancePath: string): Promise<boolean> {
    const shared = await this.getSharedDirectory()
    const instanceDir = join(instancePath, this.domain)
    return isLinkTo(instanceDir, shared)
  }

  /**
   * Link the instance's domain folder to the global shared folder.
   *
   * If the folder already exists, its files are merged into the shared folder
   * first, then the folder is replaced by a link.
   */
  async linkShared(instancePath: string): Promise<void> {
    const shared = await this.getSharedDirectory()
    const instanceDir = join(instancePath, this.domain)
    await ensureDir(shared)

    if (await isLinkTo(instanceDir, shared)) {
      return
    }

    if (await missing(instanceDir)) {
      await linkDirectory(shared, instanceDir, this)
      return
    }

    // Existing folder: merge its files into the shared folder.
    const files = await readdir(instanceDir)
    for (const name of files) {
      const filePath = join(instanceDir, name)
      const sharedFilePath = join(shared, name)
      const linked = await readlinkSafe(filePath).catch(() => '')

      if (linked) {
        await unlink(filePath)
        continue
      }

      if (await missing(sharedFilePath)) {
        await rename(filePath, sharedFilePath)
      } else {
        // Move to shared with a new name, preserving the extension.
        const ext = extname(name)
        const base = name.slice(0, name.length - ext.length)
        await rename(filePath, join(shared, `${base}-${Date.now()}${ext}`))
      }
    }

    await rm(instanceDir, { recursive: true })
    await linkDirectory(shared, instanceDir, this)
  }

  /**
   * Unlink the instance's domain folder from the global shared folder,
   * restoring an empty real directory.
   */
  async unlinkShared(instancePath: string): Promise<void> {
    const shared = await this.getSharedDirectory()
    const instanceDir = join(instancePath, this.domain)
    if (!(await isLinkTo(instanceDir, shared))) {
      return
    }
    await unlink(instanceDir)
    await ensureDir(instanceDir)
  }

  async install({ files, path }: UpdateInstanceResourcesOptions) {
    this.log(`Install ${files.length} to ${path}/${this.domain}`)
    const dir = join(path, this.domain)
    // Filter out undefined/null entries before fan-out — telemetry showed
    // `basename` called with undefined on InstanceModsService.install when
    // upstream callers passed sparse arrays. Surface the count instead of
    // throwing a TypeError that obscures the real install result.
    const validFiles = files.filter((f): f is string => typeof f === 'string' && f.length > 0)
    if (validFiles.length !== files.length) {
      this.warn(new Error(`Dropping ${files.length - validFiles.length} invalid (non-string) entries from install request to ${dir}`))
    }
    const dests = await Promise.all(validFiles.map(async (src) => {
      const dest = join(dir, basename(src))
      if (src === dest) {
        return dest
      }
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest).catch(() => undefined)])

      try {
        if (!destStat) {
          if (srcStat.isDirectory()) {
            await linkOrCopyDirectory(src, dest, this.logger)
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

    // Local file imports carry no market metadata. Only resolve it here when the
    // instance is NOT being watched (e.g. importing into a non-active instance):
    // for a watched instance the renderer-driven refresh already resolves
    // newly-added files, so doing it here too would be a duplicate lookup.
    const resourceManager = await this.app.registry.get(kResourceManager)
    if (!resourceManager.getWatched(dir)) {
      this.resolveMarketMetadata(dests).catch((e) => this.warn(e))
    }

    return dests
  }

  async uninstall({ files, path }: UpdateInstanceResourcesOptions) {
    let hasError = false
    const validFiles = files.filter((f): f is string => typeof f === 'string' && f.length > 0)
    await Promise.all(validFiles.map(async (f) => {
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

  /**
   * Actively resolve modrinth/curseforge metadata for the given files by looking
   * up the modrinth sha1 hash and the curseforge fingerprint, then persist the
   * result keyed by sha1.
   *
   * Manual import (`install`) has no other active trigger, and the metadata is
   * keyed by sha1 in the resource db, so it is applied even if the file has not
   * been scanned into a live state yet.
   */
  protected async resolveMarketMetadata(filePaths: string[]) {
    if (filePaths.length === 0) return
    const worker = await this.app.registry.getOrCreate(kResourceWorker)
    const entries = (await Promise.all(filePaths.map(async (path) => {
      try {
        const [sha1, fingerprint] = await Promise.all([
          worker.checksum(path, 'sha1'),
          worker.fingerprint(path),
        ])
        return { path, sha1, fingerprint }
      } catch {
        // Directory or unreadable file — nothing to fingerprint.
        return undefined
      }
    }))).filter((v): v is { path: string; sha1: string; fingerprint: number } => !!v)

    if (entries.length === 0) return

    const resourceManager = await this.app.registry.get(kResourceManager)
    const modrinthClient = await this.app.registry.getOrCreate(ModrinthV2Client)
    const curseforgeClient = await this.app.registry.getOrCreate(CurseforgeV1Client)

    const updates: Record<string, UpdateResourcePayload> = {}
    const getUpdate = (sha1: string) => updates[sha1] || (updates[sha1] = { hash: sha1, metadata: {} })

    const onModrinth = async () => {
      try {
        const versions = await modrinthClient.getProjectVersionsByHash(entries.map(e => e.sha1), 'sha1')
        for (const [sha1, version] of Object.entries(versions)) {
          if (!sha1 || !entries.some(e => e.sha1 === sha1)) continue
          getUpdate(sha1).metadata!.modrinth = { projectId: version.project_id, versionId: version.id }
        }
      } catch (e) {
        this.warn(e as any)
      }
    }

    const onCurseforge = async () => {
      try {
        const result = await curseforgeClient.getFingerprintsMatchesByGameId(432, entries.map(e => e.fingerprint)).catch((e) => {
          if (e instanceof CurseforgeApiError && e.status >= 400 && e.status < 500 && e.status !== 404) {
            this.error(e)
          }
          return { exactMatches: [] }
        })
        for (const f of result.exactMatches) {
          const e = entries.find(en => en.fingerprint === f.file.fileFingerprint) ||
            entries.find(en => en.sha1 === f.file.hashes.find(a => a.algo === 1)?.value)
          if (!e) continue
          getUpdate(e.sha1).metadata!.curseforge = { projectId: f.file.modId, fileId: f.file.id }
        }
      } catch (e) {
        this.warn(e as any)
      }
    }

    await Promise.allSettled([onModrinth(), onCurseforge()])

    const payloads = Object.values(updates)
    if (payloads.length > 0) {
      await resourceManager.updateMetadata(payloads)
      this.log(`Actively resolved market metadata for ${payloads.length}/${entries.length} imported ${this.domain} files`)
    }
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
