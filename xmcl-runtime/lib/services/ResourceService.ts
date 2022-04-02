import { AnyPersistedResource, AnyResource, Exception, ImportResourceOptions, ImportResourcesOptions, isPersistedResource, ParseResourceOptions, ParseResourcesOptions, PersistedResource, Resource, ResourceDomain, ResourceException, resourceLoadSemaphore, ResourceService as IResourceService, ResourceServiceKey, ResourceState, ResourceType, UpdateResourceOptions } from '@xmcl/runtime-api'
import { requireString } from '../util/object'
import { task } from '@xmcl/task'
import { FSWatcher } from 'fs'
import { readJSON, stat, unlink, writeFile } from 'fs-extra'
import watch from 'node-watch'
import { basename, extname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { FileStat, mutateResource, persistResource, readFileStat, remove, ResourceCache } from '../entities/resource'
import { fixResourceSchema } from '../util/dataFix'
import { isSystemError } from '../util/error'
import { copyPassively, ENOENT_ERROR, fileType, FileType, readdirEnsured } from '../util/fs'
import { createPromiseSignal } from '../util/promiseSignal'
import { ExportService, Singleton, StatefulService } from './Service'

export interface ParseResourceContext {
  stat?: FileStat
  sha1?: string
  fileType?: FileType
}

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
@ExportService(ResourceServiceKey)
export default class ResourceService extends StatefulService<ResourceState> implements IResourceService {
  createState() { return new ResourceState() }

  private cache = new ResourceCache()

  /**
   * The array to store the pending to import resource file path, which is the absolute file path of the resource file under the domain directory
   */
  private pending = new Set<string>()

  private loadPromises = {
    [ResourceDomain.Mods]: createPromiseSignal(),
    [ResourceDomain.Saves]: createPromiseSignal(),
    [ResourceDomain.ResourcePacks]: createPromiseSignal(),
    [ResourceDomain.Modpacks]: createPromiseSignal(),
    [ResourceDomain.ShaderPacks]: createPromiseSignal(),
    [ResourceDomain.Unknown]: createPromiseSignal(),
  }

  private watchers: Record<ResourceDomain, FSWatcher | undefined> = {
    [ResourceDomain.Mods]: undefined,
    [ResourceDomain.Saves]: undefined,
    [ResourceDomain.ResourcePacks]: undefined,
    [ResourceDomain.Modpacks]: undefined,
    [ResourceDomain.ShaderPacks]: undefined,
    [ResourceDomain.Unknown]: undefined,
  }

  protected normalizeResource(resource: string | AnyPersistedResource | AnyResource): AnyPersistedResource | undefined {
    if (typeof resource === 'string') {
      return this.cache.get(resource)
    }
    if (isPersistedResource(resource)) {
      return resource
    }
    return this.cache.get(resource.hash)
  }

  constructor(app: LauncherApp) {
    super(app, async () => {
      for (const domain of [
        ResourceDomain.Mods,
        ResourceDomain.ResourcePacks,
        ResourceDomain.Saves,
        ResourceDomain.Modpacks,
        ResourceDomain.ShaderPacks,
        ResourceDomain.Unknown,
      ]) {
        this.loadPromises[domain].accept(this.loadDomain(domain))
      }
    })
  }

  /**
   * Query in memory resource by key.
   * The key can be `hash`, `url` or `ino` of the file.
   */
  getResourceByKey(key: string | number): AnyPersistedResource | undefined {
    return this.cache.get(key)
  }

  isResourceInCache(key: string | number) {
    return !!this.cache.get(key)
  }

  /**
   * Query resource in memory by the resource query
   * @param query The resource query.
   */
  getResource(query: Query) {
    let res: PersistedResource | undefined
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

  @Singleton((key) => resourceLoadSemaphore(key))
  private async loadDomain(domain: ResourceDomain) {
    const path = this.getPath(domain)
    const files = await readdirEnsured(path)
    const result: PersistedResource[] = []
    const processFile = async (file: string) => {
      if (!file.endsWith('.json')) return
      const filePath = join(path, file)
      try {
        const resource = await this.loadMetadata(filePath)
        result.push(resource)
      } catch (e) {
        if (isSystemError(e) && e.code === ENOENT_ERROR) {
          this.warn(`The resource file ${filePath} cannot be found! Try remove this resource record!`)
          unlink(filePath).catch(() => { })
        } else {
          this.error(`Cannot load resource ${file}`)
          if (e instanceof Error && e.stack) {
            this.error(e.stack)
          } else {
            this.error(e)
          }
        }
      }
    }
    await Promise.all(files.map(processFile))
    this.log(`Load ${result.length} resources in domain ${domain}`)
    this.commitResources(result)

    this.watchers[domain] = watch(path, async (event, name) => {
      if (event === 'remove') {
        if (name.endsWith('.json') || name.endsWith('.png')) {
          // json removed means the resource is totally removed

        } else {
          // this will remove
          const resource = this.cache.get(name)
          if (resource) {
            this.state.resourcesRemove([resource])
            this.cache.discard(resource)
            this.unpersistResource(resource)
            this.log(`Remove resource ${resource.path} with its metadata`)
          } else {
            this.log(`Skip to remove untracked resource ${name} & its metadata`)
          }
        }
      } else {
        if (name.endsWith('.png')) {
          return
        }
        if (name.endsWith('.json')) {
          try {
            const resource = await this.loadMetadata(name)
            this.state.resources([resource])
            this.cache.discard(resource)
            this.cache.put(resource)
            this.log(`Update resource ${resource.path} metadata`)
          } catch (e) {
            if (isSystemError(e) && e.code === ENOENT_ERROR) {
              // the corresponded resource is missing... remove this resource metadata
              await unlink(name)
              this.log(`Remove not found resource corresponded to ${name}`)
            } else {
              this.emit('error', e)
            }
          }
        } else {
          // new file found, try to resolve & import it
          if (this.pending.has(name)) {
            // just ignore pending file. It will handle once the json metadata file is updated
            this.pending.delete(name)
            this.log(`Ignore re-import a manually importing file ${name}`)
            return
          }
          try {
            this.log(`Try to import new file ${name}`)
            await this.importResource({ restrictToDomain: domain, path: name })
          } catch (e) {
            this.emit('error', e)
          }
        }
      }
    })
  }

  private getMetadataFilePath(resource: AnyResource) {
    return this.getPath(resource.domain, resource.fileName) + '.json'
  }

  private getResourceFilePath(resource: AnyResource) {
    return this.getPath(resource.domain, resource.fileName) + resource.ext
  }

  private async loadMetadata(metadataPath: string) {
    const resourceData = await readJSON(metadataPath) // this.resourceFile.readTo(filePath)
    await fixResourceSchema({ log: this.log, warn: this.warn, error: this.error }, metadataPath, resourceData, this.getPath())

    const resourceFilePath = this.getResourceFilePath(resourceData)
    const { size, ino } = await stat(resourceFilePath)
    const resource: PersistedResource<any> = Object.freeze({
      fileName: resourceData.fileName,
      name: resourceData.name,
      domain: resourceData.domain,
      type: resourceData.type,
      metadata: resourceData.metadata,
      fileType: resourceData.fileType || await fileType(resourceFilePath),
      uri: resourceData.uri,
      date: resourceData.date,
      tags: resourceData.tags,
      hash: resourceData.hash,
      path: resourceFilePath,
      size,
      ino,
      ext: resourceData.ext,
      curseforge: resourceData.curseforge,
      modrinth: resourceData.modrinth,
      github: resourceData.github,
      iconUri: resourceData.iconUri ?? `dataroot://${resourceData.domain}/${resourceData.fileName}.png`,
    })
    return resource
  }

  whenReady(resourceDomain: ResourceDomain) {
    return this.loadPromises[resourceDomain].promise
  }

  /**
   * Remove a resource from the launcher
   * @param resourceOrKey
   */
  async removeResource(resourceOrKey: string | AnyPersistedResource) {
    const resource = this.normalizeResource(resourceOrKey)
    if (!resource) {
      throw new ResourceException({
        type: 'resourceNotFoundException',
        resource: resourceOrKey as string,
      })
    }
    this.state.resourcesRemove([resource])
    this.cache.discard(resource)
    await this.unpersistResource(resource)
  }

  async updateResource(options: UpdateResourceOptions): Promise<void> {
    const resource = this.normalizeResource(options.resource)
    if (!resource) {
      throw new ResourceException({
        type: 'resourceNotFoundException',
        resource: options.resource as string,
      })
    }
    let newResource: PersistedResource<any> | undefined
    if (options.name) {
      const name = options.name
      newResource = mutateResource<PersistedResource<any>>(resource, (r) => { r.name = name })
    }
    if (options.tags) {
      const tags = options.tags
      newResource = mutateResource<PersistedResource<any>>(newResource ?? resource, (r) => { r.tags = tags })
    }
    if (newResource) {
      this.state.resource(newResource)
      await writeFile(this.getMetadataFilePath(newResource), JSON.stringify(newResource))
    }
  }

  /**
   * Parse a single file as a resource and return the resource object
   * @param options The parse file option
   */
  async resolveResource(options: ParseResourceOptions): Promise<[AnyResource, Uint8Array | undefined]> {
    const { path } = options
    const context: ParseResourceContext = {}
    const existed = await this.queryExistedResourceByPath(path, context)
    if (existed && existed.domain !== ResourceDomain.Unknown) {
      return [mutateResource(existed, (r) => { r.path = path }), undefined]
    }
    const [resource, icon] = await this.parseResource(options, context)
    return [resource as AnyResource, icon]
  }

  /**
   * Parse multiple files and return corresponding resources
   * @param options The parse multiple files options
   */
  async resolveResources(options: ParseResourcesOptions) {
    return Promise.all(options.files.map((f) => this.resolveResource({
      path: f.path,
      source: f.source,
      type: f.type ?? options.type,
      url: f.url,
    })))
  }

  /**
   * Import the resource into the launcher.
   * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
   */
  async importResource(options: ImportResourceOptions) {
    requireString(options.path)
    const context: ParseResourceContext = {}
    const existed = await this.queryExistedResourceByPath(options.path, context)
    if (existed) {
      this.log(`Skip to import ${options.path} as resource existed in ${existed.path}`)
      return existed
    }
    const task = this.importFileTask(options, context)
    const resource = await (options.background ? task.startAndWait() : this.submit(task))

    this.log(`Persist newly added resource ${resource.path} -> ${resource.domain}`)
    return resource
  }

  /**
  * Import the resource from the same disk. This will parse the file and import it into our db by hard link.
  * If the file already existed, it will not re-import it again
  *
  * The original file will not be modified.
  *
  * @param options The options to import the resources
  *
  * @returns All import file in resource form. If the file cannot be parsed, it will be UNKNOWN_RESOURCE.
  */
  async importResources(options: ImportResourcesOptions) {
    const existedResources: AnyPersistedResource[] = []
    const newResources: AnyPersistedResource[] = []
    const errors: any[] = []
    await Promise.all(options.files.map(async (f) => {
      const context: ParseResourceContext = {}
      const existed = await this.queryExistedResourceByPath(f.path, context)
      if (existed) {
        this.log(`Skip to import ${f.path} as resource existed in ${existed.path}`)
        existedResources.push(existed)
      } else {
        try {
          const task = this.importFileTask({
            path: f.path,
            url: f.url,
            source: f.source,
            type: f.type ?? options.type,
            background: options.background,
            restrictToDomain: options.restrictToDomain,
          }, context)
          const result = await (options.background ? task.startAndWait() : this.submit(task))
          this.log(`Import and cache newly added resource ${result.path} -> ${result.domain}`)
          newResources.push(result)
        } catch (e) {
          errors.push(e)
        }
      }
    }))

    const existedCount = existedResources.length
    const unknownCount = newResources.filter(r => r.type === ResourceType.Unknown).length
    const newCount = newResources.length

    if (options.restrictToDomain) {
      this.log(`Resolve ${existedResources.length} resources from /${options.restrictToDomain}. Imported ${newCount} new resources, ${existedCount} resources existed, and ${unknownCount} unknown resource.`)
    } else {
      this.log(`Resolve ${existedResources.length} resources. Imported ${newCount} new resources, ${existedCount} resources existed, and ${unknownCount} unknown resource.`)
    }

    return newResources
  }

  /**
   * Export the resources into target directory. This will simply copy the resource out.
   * If a resource is not found, the export process will be abort. This is not a transaction process.
   */
  async exportResource(payload: { resources: (string | AnyResource)[]; targetDirectory: string }) {
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
      promises.push(copyPassively(resource.path, join(targetDirectory, resource.name + resource.ext)))
    }
    await Promise.all(promises)
  }

  // helper methods

  async queryExistedResourceByPath(path: string, context: ParseResourceContext) {
    let result: AnyPersistedResource | undefined

    let stats = context?.stat
    if (!stats) {
      stats = await readFileStat(path)
      if (context) {
        context.stat = stats
      }
    }

    if (!stats.isDirectory) {
      result = this.getResourceByKey(stats.ino)

      if (!result) {
        if (context?.sha1) {
          result = this.getResourceByKey(context.sha1)
        } else {
          const [sha1, fileType] = await this.worker().checksumAndFileType(path, 'sha1')
          if (context) {
            context.sha1 = sha1
            context.fileType = fileType
          }
          result = this.getResourceByKey(sha1)
        }
      }
    } else {
      context.sha1 = ''
      context.fileType = 'directory'
    }

    return result
  }

  /**
   * Parse a file into resource
   * @param options The parse option
   * @param context The resource context
   * @returns The resolved resource and icon
   */
  async parseResource(options: ParseResourceOptions, context: ParseResourceContext) {
    const { path, type } = options
    let sha1 = context?.sha1
    let fileType = context?.fileType
    const stat = context?.stat ?? await readFileStat(path)
    if (stat.isDirectory) {
      fileType = 'directory'
      sha1 = ''
    } else {
      if (!sha1 && !fileType) {
        [sha1, fileType] = await this.worker().checksumAndFileType(path, 'sha1')
      }
      if (!sha1) {
        sha1 = await this.worker().checksum(path, 'sha1')
      }
      if (!fileType) {
        fileType = await this.worker().fileType(path)
      }
    }
    const [resolved, icon] = await this.worker().parseResource({
      path,
      sha1,
      fileType,
      stat,
      hint: type ?? '*',
    }).catch((e) => {
      const resource: Resource<void> = {
        hash: sha1!,
        fileType: fileType!,
        ino: stat.ino,
        path,
        fileName: '',
        name: basename(path),
        size: stat.size,
        ext: extname(path),
        type: ResourceType.Unknown,
        domain: ResourceDomain.Unknown,
        metadata: undefined,
        uri: [],
      }
      return [resource, undefined] as const
    })
    return [resolved, icon] as const
  }

  /**
  * The internal method which should be called in-services. You should first call {@link parseResource} to get resolved resource and icon
  * @param resource The resource to import
  * @param context The query context
  * @see {queryExistedResourceByPath}
  */
  async importParsedResource(options: ImportResourceOptions, resolved: Resource, icon: Uint8Array | undefined) {
    if (options.restrictToDomain && resolved.domain !== options.restrictToDomain && resolved.domain !== ResourceDomain.Unknown) {
      throw new ResourceException({
        type: 'resourceDomainMismatched',
        path: options.path,
        expectedDomain: options.restrictToDomain,
        actualDomain: resolved.domain,
        actualType: resolved.type,
      }, `Non-${options.restrictToDomain} resource at ${options.path} type=${resolved.type}`)
    }
    if (resolved.domain === ResourceDomain.Unknown && options.restrictToDomain) {
      // enforced unknown resource domain
      resolved.domain = options.restrictToDomain
    }
    if (!icon && options.iconUrl) {
      icon = (await this.networkManager.request.get(options.iconUrl, { responseType: 'buffer' })).body
    }
    const result = await persistResource(resolved, this.getPath(), options.source ?? {}, options.url ?? [], icon, this.pending)
    return result as AnyPersistedResource
  }

  /**
   * Resolve resource task. This will not write the resource to the cache, but it will persist the resource to disk.
   * @throws DomainMissMatchedError
   */
  private importFileTask(options: ImportResourceOptions, context: ParseResourceContext) {
    return task('importResource', async () => {
      if (!context.stat) {
        context.stat = await readFileStat(options.path)
      }
      if (context.stat.isDirectory) {
        throw new ResourceException({
          type: 'resourceImportDirectoryException',
          path: options.path,
        })
      }
      const [resolved, icon] = await this.parseResource(options, context)
      return this.importParsedResource(options, resolved, icon)
    })
  }

  private commitResources(resources: PersistedResource[]) {
    for (const resource of resources) {
      this.cache.put(resource as any)
    }
    this.state.resources(resources as any)
  }

  protected unpersistResource(resource: PersistedResource) {
    return remove(resource, this.getPath())
  }
}
