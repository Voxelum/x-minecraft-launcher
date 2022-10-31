import { ImportResourceOptions, isPersistedResource, PartialResourceHash, PartialResourcePath, Persisted, QueryResourcesOptions, Resource, ResourceDomain, ResourceException, ResourceMetadata, ResourceService as IResourceService, ResourceServiceKey, ResourceState } from '@xmcl/runtime-api'
import { task } from '@xmcl/task'
import { AbstractLevel } from 'abstract-level'
import { ClassicLevel } from 'classic-level'
import filenamify from 'filenamify'
import { existsSync, FSWatcher } from 'fs'
import { ensureDir, ensureFile, stat, unlink } from 'fs-extra'
import { rename } from 'fs/promises'
import watch from 'node-watch'
import { basename, dirname, extname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { getResourceFileName, persistResource, ResourceCache } from '../entities/resource'
import { migrateToDatabase, upgradeResourceToV2 } from '../util/dataFix'
import { checksum, copyPassively, linkOrCopy, readdirEnsured } from '../util/fs'
import { ImageStorage } from '../util/imageStore'
import { assignIfPresent, isArrayEqual, isNonnull } from '../util/object'
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
    super(app, () => new ResourceState(), async () => {
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
      const stored = await this.storage.values().all()

      // Transform legacy format (v1) to v2
      const resources = stored.map(upgradeResourceToV2)
        .filter(v => v.size !== 0 && !v.path.endsWith('.pending'))

      this.log(`Load ${stored.length} resources from database.`)

      // Fix fabric parsing
      await Promise.all(resources.map(async (r) => {
        if (r.metadata.fabric) {
          if (!(r.metadata.fabric instanceof Array) && r.metadata.fabric.id === 'fabric') {
            const reParsed = await this.parseResourceMetadata(r)
            await this.storage.put(reParsed.hash, reParsed)
            return reParsed
          }
        }
        return r
      }))

      const promises: Promise<void>[] = []
      const toRemove: Persisted<Resource>[] = []
      const toAdd: Persisted<Resource>[] = []
      const toUpdate: Persisted<Resource>[] = []
      const fixOverlap = async (resource: Persisted<Resource>, overlapped: Persisted<Resource>) => {
        const expectedSha1 = await checksum(resource.storedPath, 'sha1')
        if (expectedSha1 === overlapped.hash) {
          const temp = overlapped
          overlapped = resource
          resource = temp
        } else if (expectedSha1 !== resource.hash) {
          // Totally broken resource...
          resource = await this.parseResourceMetadata(resource)
        }
        this.warn(`Found the overlapped resource ${resource.storedPath}, ${resource.hash} vs ${overlapped.hash}`)
        Object.assign(overlapped.metadata, resource.metadata)
        resource.metadata = overlapped.metadata
        resource.uri = [...new Set([...overlapped.uri, ...resource.uri])]
        toRemove.push(overlapped)
        toUpdate.push(resource)
        this.cache.put(resource)
      }

      // Check if the resource need to fix
      for (const resource of resources) {
        const existed = this.cache.get(resource.storedPath)
        if (existed && existed.hash !== resource.hash) {
          promises.push(fixOverlap(existed, resource))
        } else {
          toAdd.push(resource)
          this.cache.put(resource as any)
        }
      }

      // Wait all fixes are done
      await Promise.all(promises)

      // Commit all resources
      this.state.resources(toAdd)

      // Delete the stale resources and update new resource
      if (toUpdate.length > 0 || toRemove.length > 0) {
        const batch = this.storage.batch()
        toUpdate.map(res => batch.put(res.hash, res))
        toRemove.map(res => batch.del(res.hash))
        await batch.write()
      }

      await ensureDir(this.getAppDataPath('resource-images'))
    })
    this.storage = database as any
  }

  registerInstaller(domain: ResourceDomain, installer: (resource: Resource, path: string) => Promise<void>) {
    this.installers[domain] = installer
  }

  async isValidResource(resource: Resource, fast = true) {
    try {
      const s = await stat(resource.path)
      if (s.ino === resource.ino) {
        return true
      }
      if (fast) {
        return s.size === resource.size
      }
      return (await checksum(resource.path, 'sha1')) === resource.hash
    } catch (e) {
      return false
    }
  }

  async validateResource(resource: Resource, fast = true) {
    const isValid = await this.isValidResource(resource, fast)
    if (!isValid) {
      await this.removeResourceInternal([resource])
    }
    return isValid
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
            this.removeResourceInternal([resource])
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
          await this.importResource({ resources: [{ path: name, domain }], optional: true })
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
    await this.removeResourceInternal([resource])
  }

  /**
   * Remove a resource from the launcher
   * @param resourceOrKey
   */
  async removeResources(resourceOrKey: Array<string | Persisted<Resource>>) {
    const resources = resourceOrKey.map(r => this.normalizeResource(r)).filter(isNonnull)
    await this.removeResourceInternal(resources)
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
    let dirty = false
    if (options.name) {
      newResource.name = options.name
      dirty = true
    }
    if (options.tags) {
      const tags = options.tags
      newResource.tags = tags
      dirty = true
    }
    if (options.uri) {
      newResource.uri = [...new Set([...options.uri, ...newResource.uri])]
      dirty = true
    }
    if (options.metadata && Object.values(options.metadata).some(v => !!v)) {
      assignIfPresent(newResource.metadata, options.metadata, ['curseforge', 'github', 'modrinth'])
      dirty = true
    }
    if (options.icons) {
      newResource.icons = options.icons
      dirty = true
    }
    if (dirty) {
      this.state.resource(newResource)
      await this.storage.put(newResource.hash, newResource)
    }
    return newResource
  }

  async updateResources(resources: PartialResourceHash[]): Promise<Persisted<Resource>[]> {
    const batch = this.storage.batch()
    let dirty = false
    const result = resources.map(options => {
      const resource = this.normalizeResource(options.hash)
      if (!resource) {
        throw new ResourceException({
          type: 'resourceNotFoundException',
          resource: options.hash as string,
        })
      }
      const newResource: Persisted<Resource> = { ...resource }
      if (options.name && options.name !== resource.name) {
        newResource.name = options.name
        dirty = true
      }
      if (options.tags) {
        if (!isArrayEqual(options.tags, resource.tags)) {
          const tags = options.tags
          newResource.tags = tags
          dirty = true
        }
      }
      if (options.uri) {
        newResource.uri = [...new Set([...options.uri, ...newResource.uri])]
        dirty = true
      }
      if (options.metadata && Object.values(options.metadata).some(v => !!v)) {
        assignIfPresent(newResource.metadata, options.metadata, ['curseforge', 'github', 'modrinth'])
        dirty = true
      }
      if (options.icons) {
        newResource.icons = options.icons
        dirty = true
      }
      if (dirty) {
        this.state.resource(newResource)
        batch.put(newResource.hash, newResource)
      }
      return newResource
    })
    if (dirty) {
      await batch.write()
    } else {
      await batch.close()
    }
    return result
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
      if (this.pendingMetadata[resource.hash]) {
        Object.assign(resource.metadata, this.pendingMetadata[resource.hash])
      }
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
    await this.storage.close()
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

    resource.fileName = resource.fileName || getResourceFileName(resource.path)
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

    return { ...resource, ...result }
  }

  /**
  * The internal method which should be called in-services. You should first call {@link parseResourceMetadata} to get resolved resource and icon
  * @see {resolvePartialResource}
  */
  async importParsedResource(resource: Resource): Promise<Persisted<Resource>> {
    const root = this.getPath()
    let fileName = filenamify(resource.fileName, { replacement: '-' })
    let filePath = join(root, resource.domain, fileName)
    const conflicted = existsSync(filePath)
    let persisted: Persisted<Resource>

    if (conflicted) {
      // Some file have the same path. Now we more trust the real file system
      // So we try to merge data in current database
      const sha1 = await this.worker().checksum(filePath, 'sha1')

      if (sha1 === resource.hash) {
        // The file is already imported...
        // We will try to merge the resource
        const existedResource = this.cache.get(sha1)
        if (existedResource) {
          // Try to update the resource
          const newResource = await this.updateResource(resource)
          return newResource
        } else {
          // We don't have the resource in cache... which means this file is not in record even it existed...
          // We will skip to copy again but use
          // This case should be the system error...
          this.warn(`Unrecognized resource file: ${filePath}. Will use the new resource metadata.`)
          const fileStatus = await stat(filePath)
          persisted = {
            ...resource,
            path: filePath,
            ino: fileStatus.ino,
            size: fileStatus.size,
            storedDate: Date.now(),
            storedPath: filePath,
          }
        }
      } else {
        // Different file, process as normal
        persisted = await persistResource(resource, this.pending)
      }
    } else {
      // No conflicted, process as normal
      persisted = await persistResource(resource, this.pending)
    }

    async function persistResource(resolved: Resource, pending: Set<string>): Promise<Persisted<Resource>> {
      const alreadyStored = conflicted ? (await stat(filePath)).ino === resolved.ino : false

      if (!alreadyStored) {
        if (conflicted) {
          // fileName conflict
          fileName = filenamify(`${resolved.name}.${resolved.hash.slice(0, 6)}${extname(resolved.fileName)}`)
          filePath = join(root, resolved.domain, fileName)
        }

        // skip to handle the file if it's inside the resource dir
        pending.add(filePath)
        await ensureFile(filePath)
        if (dirname(resolved.path) === dirname(filePath)) {
          // just rename if they are in same dir
          await rename(resolved.path, filePath)
        } else {
          await linkOrCopy(resolved.path, filePath)
        }
      }

      const fileStatus = await stat(filePath)
      return {
        ...resolved,
        path: filePath,
        ino: fileStatus.ino,
        size: fileStatus.size,
        storedDate: Date.now(),
        storedPath: filePath,
      }
    }

    if (this.pendingMetadata[resource.hash]) {
      Object.assign(resource.metadata, this.pendingMetadata[resource.hash])
      delete this.pendingMetadata[resource.hash]
    }

    const handleOverlap = async (overlapped: Persisted<Resource>) => {
      this.warn(`Found the overlapped resource ${overlapped.storedPath}, ${persisted.hash} vs ${overlapped.hash}`)
      persisted.metadata = Object.assign({}, overlapped.metadata, persisted.metadata)
      persisted.uri = [...new Set([...overlapped.uri, ...persisted.uri])]
      await this.storage.del(overlapped.hash)
      this.cache.discard(overlapped)
      this.state.resourcesRemove([overlapped])
    }

    // Check if there already file in database
    const pathOverlapped = this.cache.get(persisted.storedPath)
    if (pathOverlapped && pathOverlapped.hash !== persisted.hash) {
      await handleOverlap(pathOverlapped)
    }

    const hashOverlapped = this.cache.get(persisted.hash)
    if (hashOverlapped && hashOverlapped.storedPath !== persisted.storedPath) {
      await handleOverlap(hashOverlapped)
    }

    const inoOverlapped = this.cache.get(persisted.ino)
    if (inoOverlapped && inoOverlapped.ino !== persisted.ino) {
      await handleOverlap(inoOverlapped)
    }

    await this.storage.put(persisted.hash, persisted)
    this.cache.put(persisted)
    this.state.resources([persisted])

    return persisted
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

  protected async removeResourceInternal(resources: Persisted<any>[]) {
    for (const resource of resources) {
      if (resource.path !== resource.storedPath) {
        this.warn(`Removing a stored resource from external reference: ${resource.path}. ${resource.storedPath}`)
      }
    }
    this.state.resourcesRemove(resources)
    const batch = this.storage.batch()
    for (const resource of resources) {
      this.cache.discard(resource)
      batch.del(resource.hash)
    }
    await batch.write()
    await Promise.all(resources.map(resource => unlink(resource.storedPath).catch(() => { })))
  }
}
