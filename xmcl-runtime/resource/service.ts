/* eslint-disable no-dupe-class-members */
import { ExportResourceOptions, ResourceService as IResourceService, ImportResourceOptions, Pagination, PartialResourceHash, PromiseSignal, ResolveResourceOptions, Resource, ResourceDomain, ResourceMetadata, ResourceServiceKey, createPromiseSignal } from '@xmcl/runtime-api'
import { FSWatcher } from 'fs'
import { ensureDir, unlink } from 'fs-extra'
import { basename, join } from 'path'
import { Inject, LauncherApp, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { ImageStorage } from '~/imageStore'
import { AbstractService, ExposeServiceKey } from '~/service'
import { SqliteWASMDialectConfig } from '~/sql'
import { copyPassively, missing, readdirEnsured } from '~/util/fs'
import { ResourceContext } from './core/ResourceContext'
import { createResourceContext } from './core/createResourceContext'
import { generateResource, getResourceAndMetadata, pickMetadata } from './core/generateResource'
import { getResourceEntry } from './core/getResourceEntry'
import { loadResources } from './core/loadResources'
import { migrateImageProtocolChange } from './core/migrateLegacy'
import { migrate } from './core/migrateResources'
import { parseMetadata } from './core/parseMetadata'
import { resolveDomain } from './core/resolveDomain'
import { tryPersistResource } from './core/tryPersistResource'
import { upsertMetadata } from './core/upsertMetadata'
import { watchResources } from './core/watchResources'
import { ResourceWorker, kResourceDatabaseOptions, kResourceWorker } from './worker'

const EMPTY_RESOURCE_SHA1 = 'da39a3ee5e6b4b0d3255bfef95601890afd80709'

export interface Query {
  hash?: string
  url?: string | string[]
  ino?: number
}

/**
 * Watch the related resource directory changes.
 *
 * Import resource process.
 *
 * 1. Parse resource file and get metadata, and push the pending metadata queue.
 * 2. Copy or link or rename the resource file to domain directory.
 *    1. If rename, it will emit a remove event to watcher, which will be ignore if the original file path is not in cache.
 * 3. The watcher find a new resource file enter the domain
 *    1. If the new file is in pending queue, it will use the metadata in pending queue
 *    2. If the new file has no pending metadata, it will re-parse the metadata, which returns step 1
 * 4. The watcher write the parsed the resource metadata
 * 5. The watcher get the metadata json update event, and validate & update the metadata cache & state
 */
@ExposeServiceKey(ResourceServiceKey)
export class ResourceService extends AbstractService implements IResourceService {
  private signals: Record<ResourceDomain, PromiseSignal<void>> = {
    [ResourceDomain.Mods]: createPromiseSignal(),
    [ResourceDomain.Saves]: createPromiseSignal(),
    [ResourceDomain.ResourcePacks]: createPromiseSignal(),
    [ResourceDomain.Modpacks]: createPromiseSignal(),
    [ResourceDomain.ShaderPacks]: createPromiseSignal(),
    [ResourceDomain.Unclassified]: createPromiseSignal(),
  }

  private watchers: Partial<Record<ResourceDomain, FSWatcher | undefined>> = {
    [ResourceDomain.Mods]: undefined,
    [ResourceDomain.Saves]: undefined,
    [ResourceDomain.ResourcePacks]: undefined,
    [ResourceDomain.Modpacks]: undefined,
    [ResourceDomain.ShaderPacks]: undefined,
  }

  private context: ResourceContext

  private installers: Partial<Record<ResourceDomain, ((resource: Resource, path: string) => Promise<void>)>> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ImageStorage) readonly imageStore: ImageStorage,
    @Inject(kResourceWorker) worker: ResourceWorker,
    @Inject(kResourceDatabaseOptions) dbOptions: SqliteWASMDialectConfig,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app, async () => {
      const root = getPath()
      const mount = async (domain: ResourceDomain) => {
        const domainPath = this.getPath(domain)
        const files = await readdirEnsured(domainPath)
        await loadResources(root, domain, files, this.context).catch(e => {
          this.error(new Error(`Fail to load resources in domain ${domain}`, { cause: e }))
        })
        this.log(`Warmed up ${domain} resources`)
        this.watchers[domain] = watchResources(domainPath, this.context)
      }
      await migrate(this.context.db).catch((e) => {
        this.error(new Error('Fail to migrate the legacy resource', { cause: e }))
      })

      await migrateImageProtocolChange(this.context)

      this.signals[ResourceDomain.Mods].accept(mount(ResourceDomain.Mods))
      this.signals[ResourceDomain.ResourcePacks].accept(mount(ResourceDomain.ResourcePacks))
      this.signals[ResourceDomain.Saves].accept(mount(ResourceDomain.Saves))
      this.signals[ResourceDomain.Modpacks].accept(mount(ResourceDomain.Modpacks))
      this.signals[ResourceDomain.ShaderPacks].accept(mount(ResourceDomain.ShaderPacks))
      this.signals[ResourceDomain.Unclassified].accept(mount(ResourceDomain.Unclassified))

      await ensureDir(this.getAppDataPath('resource-images')).catch((e) => {
        this.error(new Error('Fail to initialize resource-images folder', { cause: e }))
      })
    })

    this.context = createResourceContext(imageStore, this, this, worker, dbOptions)

    app.registryDisposer(async () => {
      for (const watcher of Object.values(this.watchers)) {
        watcher?.close()
      }
      await this.context.db.destroy()
    })
  }

  async isResourceDatabaseOpened() {
    const isOpened = await this.context.isDatabaseOpened()
    return isOpened
  }

  async getResourceMetadataByUri(uri: string): Promise<ResourceMetadata[]> {
    const result = await getResourceAndMetadata(this.context, { uris: [uri] })
    return result.map(pickMetadata)
  }

  async getResourceMetadataByHash(sha1: string): Promise<ResourceMetadata | undefined> {
    const metadata = await this.context.db.selectFrom('resources')
      .selectAll()
      .where('sha1', '=', sha1).executeTakeFirst()
    return metadata ? pickMetadata(metadata) : undefined
  }

  async getResourcesMetadataByHashes(sha1: string[]): Promise<Array<ResourceMetadata | undefined>> {
    const metadata = await this.context.db.selectFrom('resources')
      .selectAll()
      .where('sha1', 'in', sha1).execute()
    return metadata ? metadata.map(pickMetadata) : []
  }

  async getResourcesUnder({ fileNames, domain }: { fileNames: string[]; domain: ResourceDomain }): Promise<(Resource | undefined)[]> {
    const domainedPath = fileNames.map(f => join(domain, f))
    const metadata = await getResourceAndMetadata(this.context, { domainedPath })
    const path = this.getPath()
    return metadata.map((c) => generateResource(path, c, c))
  }

  /**
   * Register a installer which will be called if the resource is installed to an instance.
   * This function should apply the resource to the instance.
   *
   * @param domain The resource domain
   * @param installer The installer function
   */
  registerInstaller(domain: ResourceDomain, installer: (resource: Resource, path: string) => Promise<void>) {
    this.installers[domain] = installer
  }

  async whenReady(resourceDomain: ResourceDomain) {
    return this.signals[resourceDomain].promise
  }

  async getResources(domain: ResourceDomain, pagination?: Pagination): Promise<Resource[]> {
    await this.whenReady(domain)
    const metadata = await getResourceAndMetadata(this.context, { domain, pagination })
    return metadata.map((v) => generateResource(this.getPath(), v, v))
  }

  async getResourcesByUris(uri: string[]): Promise<Array<Resource>> {
    const result = await getResourceAndMetadata(this.context, { uris: uri })
    return result.map(r => generateResource(this.getPath(), r, r))
  }

  async getResourcesByStartsWithUri(uri: string): Promise<Resource[]> {
    const result = await getResourceAndMetadata(this.context, { startsWithUri: uri })
    return result.map(r => generateResource(this.getPath(), r, r))
  }

  async getReosurceByIno(ino: number): Promise<Resource | undefined> {
    const metadata = await getResourceAndMetadata(this.context, { ino })
    if (!metadata[0]) return undefined
    return generateResource(this.getPath(), metadata[0], metadata[0])
  }

  async getResourcesByHashes(sha1: string[]): Promise<Array<Resource | undefined>> {
    sha1 = sha1.map(s => s === EMPTY_RESOURCE_SHA1 ? 'NOOP' : s)

    const result = await getResourceAndMetadata(this.context, { sha1 })
    return result.map(r => r ? generateResource(this.getPath(), r, r) : undefined)
  }

  async getResourceByHash(sha1: string): Promise<Resource | undefined> {
    if (sha1 === EMPTY_RESOURCE_SHA1) return undefined
    const result = await getResourceAndMetadata(this.context, { sha1 })
    if (result.length === 0) return undefined
    return generateResource(this.getPath(), result[0], result[0])
  }

  async touchResource(resource: Resource) {
    const missed = await missing(resource.storedPath || resource.path)
    if (missed) {
      // Remove from database
      await this.removeResources([resource.hash])
      return false
    }
    return true
  }

  async removeResources(hashes: Array<string>) {
    const existed = await this.context.db.selectFrom('snapshots')
      .where('sha1', 'in', hashes)
      .select('domainedPath')
      .execute()
    const resourcePaths = existed.map(r => this.getPath(r.domainedPath))
    await Promise.all(resourcePaths.map(p => unlink(p).catch(() => {})))
  }

  async getResourcesByKeyword(keyword: string, domain: ResourceDomain, pagination?: Pagination): Promise<Array<Resource>> {
    const result = await getResourceAndMetadata(this.context, { domain, keyword, pagination })
    return result.map(r => generateResource(this.getPath(), r, r))
  }

  updateResources(resources: [PartialResourceHash, PartialResourceHash]): Promise<[string, string]>
  updateResources(resources: [PartialResourceHash]): Promise<[string]>
  updateResources(resources: PartialResourceHash[]): Promise<string[]>
  async updateResources(resources: PartialResourceHash[]): Promise<string[]> {
    if (resources.length === 0) return []
    await this.context.db.transaction().execute(async (trx) => {
      for (const resource of resources) {
        // this.log(`Update resource ${JSON.stringify(resource, null, 4)}`)
        if (resource.name || resource.metadata?.github || resource.metadata?.curseforge || resource.metadata?.modrinth || resource.metadata?.instance) {
          const params = {
            name: resource.name,
            github: resource.metadata?.github,
            curseforge: resource.metadata?.curseforge,
            modrinth: resource.metadata?.modrinth,
            instance: resource.metadata?.instance,
          }
          if (!params.name) delete params.name
          if (!params.github) delete params.github
          if (!params.curseforge) delete params.curseforge
          if (!params.modrinth) delete params.modrinth
          if (!params.instance) delete params.instance
          await trx.updateTable('resources')
            .where('sha1', '=', resource.hash)
            .set(params).execute()
        }
        // Upsert each tag
        if (resource.tags && resource.tags.length > 0) {
          // await trx.deleteFrom('tags').where('sha1', '=', resource.hash).execute()
          await trx.insertInto('tags').values(resource.tags.map(t => ({ tag: t, sha1: resource.hash }))).onConflict((v) => v.doNothing()).execute()
        }
        // Upsert each uri
        if (resource.uris && resource.uris.length > 0) {
          // await trx.deleteFrom('uris').where('sha1', '=', resource.hash).execute()
          await trx.insertInto('uris').values(resource.uris.map(u => ({ uri: u, sha1: resource.hash }))).onConflict((v) => v.doNothing()).execute()
        }
        // Upsert each icon
        if (resource.icons && resource.icons.length > 0) {
          // await trx.deleteFrom('icons').where('sha1', '=', resource.hash).execute()
          await trx.insertInto('icons').values(resource.icons.map(i => ({ icon: i, sha1: resource.hash }))).onConflict((v) => v.doNothing()).execute()
        }
      }
    })

    this.emit('resourceUpdate', resources)

    return []
  }

  resolveResources(options: [ResolveResourceOptions, ResolveResourceOptions]): Promise<[Resource, Resource]>
  resolveResources(options: [ResolveResourceOptions]): Promise<[Resource]>
  resolveResources(options: ResolveResourceOptions[]): Promise<Resource[]>
  async resolveResources(options: ResolveResourceOptions[]): Promise<Resource[]> {
    const result = await Promise.all(options.map(async ({ path, domain }) => {
      const resolved = await getResourceEntry(path, this.context)
      if ('domainedPath' in resolved) {
        const metadata = await getResourceAndMetadata(this.context, { domainedPath: resolved.domainedPath })
        return generateResource(this.getPath(), resolved, metadata[0], { path, domain, mtime: resolved.mtime })
      }

      try {
        const parsed = await parseMetadata(path, resolved.fileType, domain ?? ResourceDomain.Unclassified, this.context)
        if (resolved.fileType === 'directory') {
          return generateResource(this.getPath(), resolved, undefined, { path, domain })
        }
        const data = await upsertMetadata(parsed.metadata, parsed.uris, parsed.icons, parsed.name, resolved.sha1, this.context)
        return generateResource(this.getPath(), resolved, data, { path, domain })
      } catch (e) {
        return generateResource(this.getPath(), resolved, undefined, { path, domain })
      }
    }))
    return result
  }

  importResources(resources: [ImportResourceOptions], loose?: boolean): Promise<[Resource]>
  importResources(resources: [ImportResourceOptions, ImportResourceOptions], loose?: boolean): Promise<[Resource, Resource]>
  importResources(resources: ImportResourceOptions[], loose?: boolean): Promise<Resource[]>
  async importResources(options: ImportResourceOptions[], loose?: boolean): Promise<Resource[]> {
    // We need to resolve the domain of the resource
    const resolved = await this.resolveResources(options)
    const result = await Promise.all(resolved.map(async (resolved, index) => {
      if (resolved.size === 0 && resolved.fileType !== 'directory') return
      try {
        if (resolved.fileType === 'directory') {
          // Will not persist the dictionary as it cannot calculate hash
          return resolved
        }
        if (resolved.storedPath) {
          return resolved
        }
        if (!resolved.fileType && resolved.path.endsWith('.txt')) {
          return resolved
        }
        if (resolved.domain === ResourceDomain.Unclassified) {
          resolved.domain = resolveDomain(resolved.metadata)
        }

        const option = options[index]

        if (option.metadata || option.uris || option.icons) {
          const data = await upsertMetadata(option.metadata ?? {}, option.uris ?? [], option.icons ?? [], resolved.fileName, resolved.hash, this.context)
          resolved.icons = resolved.icons ? [...resolved.icons, ...data.icons] : data.icons
          resolved.uris = resolved.uris ? [...resolved.uris, ...data.uris] : data.uris
          resolved.metadata = data
        }

        const storedPathOrErr = await tryPersistResource(resolved, this.getPath(), this.context).catch(e => e)
        if (storedPathOrErr instanceof Array) {
          const resource = { ...resolved, storedPath: storedPathOrErr[0] }

          this.log(`Persist new resource ${resource.path} -> ${storedPathOrErr[0]} linked=${storedPathOrErr[1]}`)

          return resource
        }
        if (loose) {
          return resolved
        }
        throw storedPathOrErr
      } catch (e) {
        this.error(e as Error)
        return undefined
      }
    }))

    return result.filter(r => r) as Resource[]
  }

  async exportResources({ resources, targetDirectory }: ExportResourceOptions) {
    const promises = [] as Array<Promise<string>>
    const sha1s = resources.map(r => typeof r === 'string' ? r : r.hash)
    const entries = await this.context.db.selectFrom('snapshots')
      .selectAll()
      .where('sha1', 'in', sha1s)
      .execute()
    for (const e of entries) {
      const from = this.getPath(e.domainedPath)
      const to = join(targetDirectory, basename(e.domainedPath))
      promises.push(copyPassively(from, to).then(() => to))
    }
    const result = await Promise.all(promises)
    return result
  }

  async install(installOptions: { instancePath: string; resource: Resource }) {
    const { instancePath, resource } = installOptions

    const installer = this.installers[resource.domain]

    if (!installer) {
      throw Object.assign(new Error(`Not found the resource installer for domain ${resource.domain}`), { resource, name: 'InstallResourceError' })
    }

    await installer(resource, instancePath)
  }
}
