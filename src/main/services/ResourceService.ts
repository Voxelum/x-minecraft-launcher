import { task } from '@xmcl/task'
import { stat, unlink } from 'fs-extra'
import { basename, extname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { AggregateExecutor } from '../util/aggregator'
import { RelativeMappedFile } from '../util/persistance'
import { BufferJsonSerializer } from '../util/serialize'
import AbstractService, { ExportService, internal } from './Service'
import { FileStat, mutateResource, persistResource, readFileStat, remove, ResourceCache } from '/@main/entities/resource'
import { fixResourceSchema } from '/@main/util/dataFix'
import { copyPassively, ENOENT_ERROR, fileType, FileType, readdirEnsured } from '/@main/util/fs'
import { Exception } from '/@shared/entities/exception'
import { AnyPersistedResource, AnyResource, isPersistedResource, PersistedResource } from '/@shared/entities/resource'
import { PersistedResourceSchema, Resource, ResourceDomain, ResourceType } from '/@shared/entities/resource.schema'
import { ImportFileOptions, ImportFilesOptions, ParseFileOptions, ParseFilesOptions, RenameResourceOptions, ResourceService as IResourceService, ResourceServiceKey, SetResourceTagsOptions } from '/@shared/services/ResourceService'
import { isNonnull, requireString } from '/@shared/util/assert'

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

@ExportService(ResourceServiceKey)
export default class ResourceService extends AbstractService implements IResourceService {
  private cache = new ResourceCache()

  private loadPromises: Record<string, Promise<void>> = {}

  private resourceRemove = new AggregateExecutor<AnyPersistedResource, AnyPersistedResource[]>(_ => _,
    (res) => {
      this.commit('resourcesRemove', res)
      for (const resource of res) {
        this.cache.discard(resource)
        this.unpersistResource(resource)
      }
    }, 1000)

  private resourceUpdate = new AggregateExecutor<AnyPersistedResource, AnyPersistedResource[]>(_ => _,
    (res) => {
      this.commit('resources', res)
      for (const resource of res) {
        this.cache.discard(resource)
        this.cache.put(resource)
        this.resourceFile.writeTo(this.getPath(resource.location + '.json'), { ...(resource as any), version: 1 })
      }
    }, 1000)

  private resourceFile = new RelativeMappedFile<PersistedResourceSchema>('', new BufferJsonSerializer(PersistedResourceSchema))

  @internal
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
    super(app)
  }

  /**
   * Query in memory resource by key.
   * The key can be `hash`, `url` or `ino` of the file.
   */
  @internal
  getResourceByKey(key: string | number): AnyPersistedResource | undefined {
    return this.cache.get(key)
  }

  @internal
  isResourceInCache(key: string | number) {
    return !!this.cache.get(key)
  }

  /**
   * Query resource in memory by the resource query
   * @param query The resource query.
   */
  @internal
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

  @internal
  private async loadDomain(domain: string) {
    const path = this.getPath(domain)
    const files = await readdirEnsured(path)
    const result: PersistedResource[] = []
    const processFile = async (file: string) => {
      if (!file.endsWith('.json')) return
      const filePath = join(path, file)
      try {
        const resourceData = await this.resourceFile.readTo(filePath)

        await fixResourceSchema({ log: this.log, warn: this.warn, error: this.error }, filePath, resourceData, this.getPath())

        const resourceFilePath = this.getPath(resourceData.location) + resourceData.ext
        const { size, ino } = await stat(resourceFilePath)
        const resource: PersistedResource<any> = Object.freeze({
          location: resourceData.location,
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
          github: resourceData.github,
        })
        result.push(resource)
      } catch (e) {
        if (e.code === ENOENT_ERROR) {
          this.warn(`The resource file ${filePath} cannot be found! Remove this resource record!`)
          unlink(filePath)
        } else {
          this.error(`Cannot load resource ${file}`)
          if (e.stack) {
            this.error(e.stack)
          } else {
            this.error(e)
          }
        }
      }
    }
    await Promise.all(files.map(processFile))
    this.commitResources(result)
  }

  @internal
  async initialize() {
    for (const domain of ['mods', 'resourcepacks', 'saves', 'modpacks', 'unknown']) {
      this.loadPromises[domain] = this.loadDomain(domain)
    }
  }

  whenModsReady() {
    return this.loadPromises.mods
  }

  whenResourcePacksReady() {
    return this.loadPromises.resourcepacks
  }

  /**
   * Remove a resource from the launcher
   * @param resourceOrKey
   */
  async removeResource(resourceOrKey: string | AnyPersistedResource) {
    const resource = this.normalizeResource(resourceOrKey)
    if (!resource) {
      throw new Exception({
        type: 'resourceNotFoundException',
        resource: resourceOrKey as string,
      })
    }
    this.resourceRemove.push(resource)
  }

  /**
   * Rename resource, this majorly affect displayed name.
   */
  async renameResource(options: RenameResourceOptions) {
    const resource = this.normalizeResource(options.resource)
    if (!resource) {
      throw new Exception({
        type: 'resourceNotFoundException',
        resource: options.resource as string,
      })
    }
    const result = mutateResource<PersistedResource<any>>(resource, (r) => { r.name = options.name })
    this.resourceUpdate.push(result)
  }

  /**
   * Set the resource tags.
   */
  async setResourceTags(options: SetResourceTagsOptions) {
    const resource = this.normalizeResource(options.resource)
    if (!resource) {
      throw new Exception({
        type: 'resourceNotFoundException',
        resource: options.resource as string,
      })
    }
    const result = mutateResource<PersistedResource<any>>(resource, (r) => { r.tags = options.tags })
    this.resourceUpdate.push(result)
  }

  /**
   * Parse a single file as a resource and return the resource object
   * @param options The parse file option
   */
  async parseFile(options: ParseFileOptions): Promise<[AnyResource, Uint8Array | undefined]> {
    const { path } = options
    const context: ParseResourceContext = {}
    const existed = await this.queryExistedResourceByPath(path, context)
    if (existed) {
      return [mutateResource(existed, (r) => { r.path = path }), undefined]
    }
    const [resource, icon] = await this.resolveResource(options, context)
    return [resource as AnyResource, icon]
  }

  /**
   * Parse multiple files and return corresponding resources
   * @param options The parse multiple files options
   */
  async parseFiles(options: ParseFilesOptions) {
    return Promise.all(options.files.map((f) => this.parseFile({
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
  async importFile(options: ImportFileOptions) {
    requireString(options.path)
    const context: ParseResourceContext = {}
    const existed = await this.queryExistedResourceByPath(options.path, context)
    if (existed) {
      this.log(`Skip to import ${options.path} as resource existed in ${existed.path}`)
      return existed
    }
    const task = this.importFileTask(options, context)
    const resource = await (options.background ? task.startAndWait() : this.submit(task))

    this.log(`Import and cache newly added resource ${resource.path} -> ${resource.domain}`)
    this.resourceUpdate.push(resource)
    return resource
  }

  /**
  * Import the resource from the same disk. This will parse the file and import it into our db by hardlink.
  * If the file already existed, it will not re-import it again
  *
  * The original file will not be modified.
  *
  * @param options The options to import the resources
  *
  * @returns All import file in resource form. If the file cannot be parsed, it will be UNKNOWN_RESOURCE.
  */
  async importFiles(options: ImportFilesOptions) {
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
    this.commitResources(newResources.filter(isNonnull))

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
        throw new Exception({
          type: 'resourceNotFoundException',
          resource: r,
        })
      }
      promises.push(copyPassively(resource.path, join(targetDirectory, resource.name + resource.ext)))
    }
    await Promise.all(promises)
  }

  // helper methods

  @internal
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
          const [sha1, fileType] = await this.worker().checksumAndFileType({ path, algorithm: 'sha1' })
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
   * Resolve a file into resource
   * @param options The parse option
   * @param context The resource context
   * @returns The resolved resource and icon
   */
  @internal
  async resolveResource(options: ParseFileOptions, context: ParseResourceContext) {
    const { path, type } = options
    let sha1 = context?.sha1
    let fileType = context?.fileType
    const stat = context?.stat ?? await readFileStat(path)
    if (stat.isDirectory) {
      fileType = 'directory'
      sha1 = ''
    } else {
      if (!sha1 && !fileType) {
        [sha1, fileType] = await this.worker().checksumAndFileType({ algorithm: 'sha1', path })
      }
      if (!sha1) {
        sha1 = await this.worker().checksum({ algorithm: 'sha1', path })
      }
      if (!fileType) {
        fileType = await this.worker().fileType({ path })
      }
    }
    const [resolved, icon] = await this.worker().resolveResource({
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
        location: '',
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
  * The internal method which should be called in-services. You should first call {@link resolveResource} to get resolved resource and icon
  * @param resource The resource to import
  * @param context The query context
  * @see {queryExistedResourceByPath}
  */
  @internal
  async importParsedResource(options: ImportFileOptions, resolved: Resource, icon: Uint8Array | undefined) {
    if (options.restrictToDomain && resolved.domain !== options.restrictToDomain) {
      throw new Exception({
        type: 'resourceDomainMissmatched',
        path: options.path,
        expectedDomain: options.restrictToDomain,
        actualDomain: resolved.domain,
        actualType: resolved.type,
      }, `Non-${options.restrictToDomain} resource at ${options.path} type=${resolved.type}`)
    }

    const result = await persistResource(resolved, this.getPath(), options.source ?? {}, options.url ?? [], icon)
    return result as AnyPersistedResource
  }

  /**
   * Resolve resource task. This will not write the resource to the cache, but it will persist the resource to disk.
   * @throws DomainMissMatchedError
   */
  @internal
  private importFileTask(options: ImportFileOptions, context: ParseResourceContext) {
    return task('importResource', async () => {
      if (!context.stat) {
        context.stat = await readFileStat(options.path)
      }
      if (context.stat.isDirectory) {
        throw new Exception({
          type: 'resourceImportDirectoryException',
          path: options.path,
        })
      }
      const [resolved, icon] = await this.resolveResource(options, context)
      return this.importParsedResource(options, resolved, icon)
    })
  }

  @internal
  private commitResources(resources: PersistedResource[]) {
    for (const resource of resources) {
      this.cache.put(resource as any)
    }
    this.commit('resources', resources as any)
  }

  @internal
  protected unpersistResource(resource: PersistedResource) {
    return remove(resource, this.getPath())
  }
}
