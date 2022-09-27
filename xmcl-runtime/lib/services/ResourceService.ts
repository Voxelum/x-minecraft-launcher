import { ImportResourceOptions, isPersistedResource, PartialResourceHash, PartialResourcePath, Persisted, QueryResourcesOptions, Resource, ResourceDomain, ResourceException, ResourceMetadata, ResourceService as IResourceService, ResourceServiceKey, ResourceState } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { AbstractLevel } from 'abstract-level'
import { ClassicLevel } from 'classic-level'
import { FSWatcher } from 'fs'
import { ensureDir, stat, unlink } from 'fs-extra'
import watch from 'node-watch'
import { basename, extname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { persistResource, ResourceCache } from '../entities/resource'
import { migrateToDatabase, upgradeDatabaseV2 } from '../util/dataFix'
import { copyPassively, readdirEnsured } from '../util/fs'
import { ImageStorage } from '../util/imageStore'
import { assignIfPresent, isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { createPromiseSignal, PromiseSignal } from '../util/promiseSignal'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

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
export class ResourceService extends StatefulService<ResourceState> implements IResourceService {
  private cache = new ResourceCache()

  readonly storage: AbstractLevel<string | Buffer, string, Persisted<Resource>>
  /**
   * The array to store the pending to import resource file path, which is the absolute file path of the resource file under the domain directory
   */
  private pending = new Set<string>()

  private pendingMetadata: Record<string, ResourceMetadata> = {}

  private loadPromises: Partial<Record<ResourceDomain, PromiseSignal<void>>> = {
    [ResourceDomain.Mods]: createPromiseSignal(),
    [ResourceDomain.Saves]: createPromiseSignal(),
    [ResourceDomain.ResourcePacks]: createPromiseSignal(),
    [ResourceDomain.Modpacks]: createPromiseSignal(),
    [ResourceDomain.ShaderPacks]: createPromiseSignal(),
  }

  private watchers: Partial<Record<ResourceDomain, FSWatcher | undefined>> = {
    [ResourceDomain.Mods]: undefined,
    [ResourceDomain.Saves]: undefined,
    [ResourceDomain.ResourcePacks]: undefined,
    [ResourceDomain.Modpacks]: undefined,
    [ResourceDomain.ShaderPacks]: undefined,
  }

  private installers: Partial<Record<ResourceDomain, ((resource: Resource, path: string) => Promise<void>)>> = {}

  protected normalizeResource(resource: string | Persisted<Resource> | Resource): Persisted<Resource> | undefined {
    if (typeof resource === 'string') {
      return this.cache.get(resource)
    }
    if (isPersistedResource(resource)) {
      return resource
    }
    return this.cache.get(resource.hash)
  }

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ImageStorage) readonly imageStore: ImageStorage,
    @Inject(ClassicLevel) database: ClassicLevel) {
    super(app, ResourceServiceKey, () => new ResourceState(), async () => {
      for (const domain of [
        ResourceDomain.Mods,
        ResourceDomain.ResourcePacks,
        ResourceDomain.Saves,
        ResourceDomain.Modpacks,
        ResourceDomain.ShaderPacks,
      ]) {
        const promise = this.load(domain)
        this.loadPromises[domain]?.accept(promise)
      }
      const result = await this.storage.values().all()
      const mapped = result.map(upgradeDatabaseV2)
      this.log(`Load ${result.length} resources from database.`)
      await Promise.all(mapped.map(async (r) => {
        if (r.metadata.fabric) {
          if (!(r.metadata.fabric instanceof Array) && r.metadata.fabric.id === 'fabric') {
            const reParsed = await this.parseResourceMetadata(r)
            await this.storage.put(reParsed.hash, reParsed)
            return reParsed
          }
        }
        return r
      }))
      this.commitResources(mapped)
      await ensureDir(this.getAppDataPath('resource-images'))
    })
    // this.storage = database.sublevel('resources', { keyEncoding: 'hex', valueEncoding: 'json' })
    this.storage = database as any
  }

  registerInstaller(domain: ResourceDomain, installer: (resource: Resource, path: string) => Promise<void>) {
    this.installers[domain] = installer
  }

  /**
   * Query in memory resource by key.
   * The key can be `hash`, `url` or `ino` of the file.
   */
  getResourceByKey(key: string | number): Persisted<Resource> | undefined {
    return this.cache.get(key)
  }

  isResourceInCache(key: string | number) {
    return !!this.cache.get(key)
  }

  /**
   * Query resource in memory by the resource query
   * @param query The resource query.
   */
  getOneResource(query: Query) {
    let res: Persisted<Resource> | undefined
    if (query.hash) {
      res = this.cache.get(query.hash)
      if (res) return res
    }
    if (query.url) {
      if (typeof query.url === 'string') {
        res = this.cache.get(query.url)
        if (res) return res
      } else {
        for (const u of query.url) {
          res = this.cache.get(u)
          if (res) return res
        }
      }
    }
    if (query.ino) {
      res = this.cache.get(query.ino)
      if (res) return res
    }
    return undefined
  }

  queryResources(query: QueryResourcesOptions): Promise<Resource[]> {
    throw new Error('Method not implemented.')
  }

  getResource(key: string): Promise<Resource | undefined> {
    return this.storage.get(key)
  }

  @Singleton(d => d)
  async load(domain: ResourceDomain) {
    const path = this.getPath(domain)
    const files = await readdirEnsured(path)
    await migrateToDatabase.call(this, domain, files.map(f => join(path, f)))

    this.watchers[domain] = watch(path, async (event, name) => {
      if (event === 'remove') {
        if (name.endsWith('.json') || name.endsWith('.png') || name.endsWith('.pending')) {
          // json removed means the resource is totally removed
        } else {
          // this will remove
          const resource = this.cache.get(name)
          if (resource) {
            this.removeResourceInternal(resource)
            this.log(`Remove resource ${resource.path} with its metadata`)
          } else {
            this.log(`Skip to remove untracked resource ${name} & its metadata`)
          }
        }
      } else {
        if (name.endsWith('.png') || name.endsWith('.pending')) {
          return
        }
        // new file found, try to resolve & import it
        if (this.pending.has(name)) {
          // just ignore pending file. It will handle once the json metadata file is updated
          this.pending.delete(name)
          this.log(`Ignore re-import a manually importing file ${name}`)
          return
        }
        try {
          this.log(`Try to import new file ${name}`)
          await this.importResource({ resources: [{ path, domain }], optional: true })
        } catch (e) {
          this.emit('error', e)
        }
      }
    })
  }

  async whenReady(resourceDomain: ResourceDomain) {
    await this.loadPromises[resourceDomain]?.promise
  }

  /**
   * Remove a resource from the launcher
   * @param resourceOrKey
   */
  async removeResource(resourceOrKey: string | Persisted<Resource>) {
    const resource = this.normalizeResource(resourceOrKey)
    if (!resource) {
      throw new ResourceException({
        type: 'resourceNotFoundException',
        resource: resourceOrKey as string,
      })
    }
    await this.removeResourceInternal(resource)
  }

  async updateResource(options: PartialResourceHash): Promise<Persisted<Resource>> {
    const resource = this.normalizeResource(options.hash)
    if (!resource) {
      throw new ResourceException({
        type: 'resourceNotFoundException',
        resource: options.hash as string,
      })
    }
    const newResource: Persisted<Resource> = { ...resource }
    if (options.name) {
      newResource.name = options.name
    }
    if (options.tags) {
      const tags = options.tags
      newResource.tags = tags
    }
    if (options.uri) {
      newResource.uri = [...new Set([...options.uri, ...newResource.uri])]
    }
    if (options.metadata) {
      assignIfPresent(newResource.metadata, options.metadata, ['curseforge', 'github', 'modrinth'])
    }
    if (options.icons) {
      newResource.icons = options.icons
    }
    this.state.resource(newResource)
    await this.storage.put(newResource.hash, newResource)
    return newResource
  }

  /**
   * Parse a single file as a resource and return the resource object
   * @param partialResources All partial resource headers to parse
   */
  async resolveResource(partialResources: PartialResourcePath[]): Promise<Resource[]> {
    const result = await Promise.all(partialResources.map(async (res) => {
      const resolved = await this.resolvePartialResource(res)
      if (isPersistedResource(resolved)) {
        return { ...resolved, path: res.path }
      }
      const resource = await this.parseResourceMetadata(resolved)
      return resource
    }))
    return result.filter(isNonnull)
  }

  markResourceMetadata(sha1: string, source: ResourceMetadata) {
    this.pendingMetadata[sha1] = source
  }

  /**
   * Import the resource into the launcher.
   * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
   */
  async importResource(options: ImportResourceOptions): Promise<Persisted<Resource>[]> {
    const result = await Promise.all(options.resources.map(async (partial) => {
      const resolved = await this.resolvePartialResource(partial)
      if (isPersistedResource(resolved)) {
        this.log(`Found existed resource (${resolved.path}) to import ${partial.path}. Update this resource metadata if possible`)
        await this.updateResource({ ...partial, hash: resolved.hash })
        return resolved
      }

      if ((resolved.domain === ResourceDomain.Unclassified || resolved.fileType === 'directory') && options.optional) {
        return undefined
      }

      const task = this.importFileTask(resolved)
      const resource = await (options.background ? task.startAndWait() : this.submit(task))

      if (resource.domain === ResourceDomain.Modpacks) {
        this.emit('modpackImport', { path: resource.path, name: resource.name })
      }

      this.log(`Persist newly added resource ${resource.path} -> ${resource.domain}`)

      return resource
    }))

    return result.filter(isNonnull)
  }

  /**
   * Export the resources into target directory. This will simply copy the resource out.
   * If a resource is not found, the export process will be abort. This is not a transaction process.
   */
  async exportResource(payload: { resources: (string | Resource)[]; targetDirectory: string }) {
    const { resources, targetDirectory } = payload

    const promises = [] as Array<Promise<any>>
    for (const r of resources) {
      const resource = this.normalizeResource(r)
      if (!resource) {
        throw new ResourceException({
          type: 'resourceNotFoundException',
          resource: r,
        })
      }
      promises.push(copyPassively(resource.path, join(targetDirectory, resource.fileName)))
    }
    await Promise.all(promises)
  }

  async dispose(): Promise<void> {
    for (const watcher of Object.values(this.watchers)) {
      watcher?.close()
    }
  }

  // helper methods

  getExistedCurseforgeResource(projectId: number, fileId: number) {
    const mod = this.state.mods.find(m => m.metadata.curseforge && m.metadata.curseforge.fileId === fileId && m.metadata.curseforge.projectId === projectId)
    if (mod) return mod
    const res = this.state.resourcepacks.find(m => m.metadata.curseforge && m.metadata.curseforge.fileId === fileId && m.metadata.curseforge.projectId === projectId)
    if (res) return res
  }

  getExistedModrinthResource(projId: string, verId: string) {
    const mod = this.state.mods.find(m => m.metadata.modrinth && m.metadata.modrinth.projectId === projId && m.metadata.modrinth.versionId === verId)
    if (mod) return mod
  }

  /**
   * Resolve a partial resource which only has `path` into the resolved resource.
   */
  async resolvePartialResource(resource: PartialResourcePath): Promise<Resource | Persisted<Resource>> {
    if (!resource.size || !resource.fileType || !resource.ino) {
      const stats = await stat(resource.path)
      if (stats.isDirectory()) {
        resource.fileType = 'dictionary'
      }
      resource.size = stats.size
      resource.ino = stats.ino
    }

    if (resource.fileType !== 'dictionary') {
      let result = this.getResourceByKey(resource.ino)

      if (!result) {
        if (resource.hash) {
          result = this.getResourceByKey(resource.hash)
        } else {
          const [sha1, fileType] = await this.worker().checksumAndFileType(resource.path, 'sha1')
          resource.hash = sha1
          resource.fileType = fileType
          result = this.getResourceByKey(sha1)
        }
      }

      if (result) {
        return result
      }
    } else {
      resource.hash = ''
      resource.fileType = 'directory'
    }

    resource.fileName = resource.fileName || basename(resource.path)
    resource.name = resource.name || basename(resource.fileName, extname(resource.fileName))
    resource.version = 2
    resource.tags = resource.tags || []
    resource.uri = resource.uri || []
    resource.domain = resource.domain || ResourceDomain.Unclassified
    resource.metadata = resource.metadata ? resource.metadata : {}

    return resource as Resource
  }

  async install(installOptions: { instancePath: string; resource: Resource }) {
    const { instancePath, resource } = installOptions

    const installer = this.installers[resource.domain]

    if (!installer) {
      throw new Error('')
    }

    await installer(resource, instancePath)
  }

  /**
   * Parse a resource metadata.
   * @param resource The input resource
   * @returns The new resource object with parsed metadata.
   */
  async parseResourceMetadata<T extends Resource>(resource: T): Promise<T> {
    const { resource: result, icons } = await this.worker().parseResourceMetadata(resource)

    const paths = await Promise.all(icons.map(async (icon) => this.imageStore.addImage(icon)))
    result.icons = result.icons ? ([...resource.icons!, ...paths]) : paths

    return result as T
  }

  /**
  * The internal method which should be called in-services. You should first call {@link parseResourceMetadata} to get resolved resource and icon
  * @see {resolvePartialResource}
  */
  async importParsedResource(resource: Resource): Promise<Persisted<Resource>> {
    // if (resolved.domain !== ResourceDomain.Unknown) {
    //   throw new ResourceException({
    //     type: 'resourceDomainMismatched',
    //     path: options.path,
    //     expectedDomain: options.restrictToDomain,
    //     actualDomain: resolved.domain,
    //     actualType: resolved.type,
    //   }, `Non-${options.restrictToDomain} resource at ${options.path} type=${resolved.type}`)
    // }

    const result = await persistResource(resource, this.getPath(), this.pending)

    await this.storage.put(result.hash, result)
    this.commitResources([result])

    return result as Persisted<Resource>
  }

  /**
   * Resolve resource task. This will not write the resource to the cache, but it will persist the resource to disk.
   * @throws DomainMissMatchedError
   */
  private importFileTask(resource: Resource) {
    return task('importResource', async () => {
      if (resource.fileType === 'dictionary') {
        throw new ResourceException({
          type: 'resourceImportDirectoryException',
          path: resource.path,
        })
      }
      const resolved = await this.parseResourceMetadata(resource)
      return this.importParsedResource(resolved)
    })
  }

  private commitResources(resources: Persisted<Resource>[]) {
    for (const resource of resources) {
      this.cache.put(resource as any)
    }
    this.state.resources(resources as any)
  }

  protected async removeResourceInternal(resource: Persisted<any>) {
    if (resource.path !== resource.storedPath) {
      this.warn(`Removing a stored resource from external reference: ${resource.path}. ${resource.storedPath}`)
    }
    this.state.resourcesRemove([resource])
    this.cache.discard(resource)
    this.storage.del(resource.hash)
    await unlink(resource.storedPath).catch(() => { })
  }
}
