import { task } from '@xmcl/task'
import { stat } from 'fs-extra'
import debounce from 'lodash.debounce'
import { join } from 'path'
import { RelativeMappedFile } from '../util/persistance'
import { BufferJsonSerializer } from '../util/serialize'
import AbstractService, { Service } from './Service'
import { mutateResource, persistResource, remove, ResourceCache, SourceInformation } from '/@main/entities/resource'
import { fixResourceSchema } from '/@main/util/dataFix'
import { copyPassively, isDirectory, readdirEnsured } from '/@main/util/fs'
import { AnyPersistedResource, AnyResource, isPersistedResource, PersistedResource } from '/@shared/entities/resource'
import { PersistedResourceSchema, ResourceDomain, ResourceType } from '/@shared/entities/resource.schema'
import { isNonnull, isNullOrUndefine, requireString } from '/@shared/util/assert'

export type ImportTypeHint = string | '*' | 'mods' | 'forge' | 'fabric' | 'resourcepack' | 'liteloader' | 'curseforge-modpack' | 'save'

export interface ParseFileOptions {
  /**
   * The real file path of the resource
   */
  path: string
  /**
   * The hint for the import file type
   */
  type?: ImportTypeHint
  /**
   * The extra info you want to provide to the source of the resource
   */
  source?: SourceInformation
  /**
   * The file urls
   */
  url?: string[]
}

export interface ImportFileOptions extends ParseFileOptions {
  /**
     * Require the resource to be these specific domain
     */
  restrictToDomain?: ResourceDomain
  /**
   * Is import file task in background?
   */
  background?: boolean
}

export interface ParseFilesOptions {
  files: Array<ParseFileOptions>
  /**
   * The hint for the import file type
   */
  type?: ImportTypeHint
}

export interface ImportFilesOptions extends ParseFilesOptions {
  /**
   * Is import file task in background?
   */
  background?: boolean
  /**
   * Require the resource to be these specific domain
   */
  restrictToDomain?: ResourceDomain
}

export interface Query {
  hash?: string
  url?: string | string[]
  ino?: number
}

export interface AddResourceOptions {
  path: string
  hash?: string
  type?: ImportTypeHint
  source?: SourceInformation
}

class DomainMissMatchedError extends Error {
  constructor(domain: string, path: string, type: string) {
    super(`Non-${domain} resource at ${path} type=${type}`)
  }
}

@Service
export default class ResourceService extends AbstractService {
  private cache = new ResourceCache()

  private loadPromises: Record<string, Promise<void>> = {}

  private resourceRemoveQueue: AnyPersistedResource[] = []

  private resourceFile = new RelativeMappedFile<PersistedResourceSchema>('', new BufferJsonSerializer(PersistedResourceSchema))

  private commitUpdate = debounce(async () => {
    const queue = this.resourceRemoveQueue
    if (queue.length > 0) {
      this.resourceRemoveQueue = []
      this.commit('resourcesRemove', queue)
      for (const resource of queue) {
        this.cache.discard(resource)
        await this.unpersistResource(resource)
      }
    }
  }, 500)

  protected normalizeResource(resource: string | AnyPersistedResource | AnyResource): AnyPersistedResource | undefined {
    if (typeof resource === 'string') {
      return this.cache.get(resource)
    }
    if (isPersistedResource(resource)) {
      return resource
    }
    return this.cache.get(resource.hash)
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

  private async loadDomain(domain: string) {
    const path = this.getPath(domain)
    const files = await readdirEnsured(path)
    const result: PersistedResource[] = []
    const processFile = async (file: string) => {
      try {
        const filePath = join(path, file)
        const resourceData = await this.resourceFile.readTo(filePath)

        await fixResourceSchema({ log: this.log, warn: this.warn, error: this.error }, filePath, resourceData, this.getPath())

        const resourceFilePath = this.getPath(resourceData.location) + resourceData.ext
        const { size, ino } = await stat(resourceFilePath)
        const resource = Object.freeze({
          location: resourceData.location,
          name: resourceData.name,
          domain: resourceData.domain,
          type: resourceData.type,
          metadata: resourceData.metadata,
          fileType: resourceData.fileType,
          uri: resourceData.uri,
          date: resourceData.date,
          tags: resourceData.tags,
          hash: resourceData.hash,
          path: resourceFilePath,
          size,
          ino,
          ext: resourceData.ext,
          curseforge: resourceData.curseforge,
          github: resourceData.github
        })
        result.push(resource)
      } catch (e) {
        this.error(`Cannot load resource ${file}`)
        if (e.stack) {
          this.error(e.stack)
        } else {
          this.error(e)
        }
        return undefined
      }
    }
    await Promise.all(files.map(processFile))
    this.commitResources(result)
  }

  async initialize() {
    for (const domain of ['mods', 'resourcepacks', 'saves', 'modpacks']) {
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
    if (!resource) return
    this.resourceRemoveQueue.push(resource)
    await this.commitUpdate()
  }

  /**
   * Rename resource, this majorly affect displayed name.
   */
  async renameResource(option: { resource: string | AnyPersistedResource; name: string }) {
    const resource = this.normalizeResource(option.resource)
    if (!resource) return
    const result = mutateResource<any>(resource, (r) => { r.name = option.name })
    this.cache.discard(resource)
    this.cache.put(result)
    this.commit('resource', result)
  }

  async parseFiles() {

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
    const existedResources = (await Promise.all(options.files.map((f) => this.queryExistedResourceByPath(f.path)))).filter(isNonnull)

    const allResources = await Promise.all(options.files.map(async (f, i) => {
      const existed = existedResources[i]
      if (existed) {
        return existed
      }
      try {
        const fstat = await stat(f.path)
        if (fstat.isDirectory()) {
          throw new Error(`Cannot import ${f.path} as it's a directory!`)
        }
        const task = this.importFileTask({
          path: f.path,
          url: f.url,
          source: f.source,
          type: f.type ?? options.type,
          background: options.background,
          restrictToDomain: options.restrictToDomain
        })
        return options.background ? task.startAndWait() : this.submit(task)
      } catch (e) {
        if (e instanceof DomainMissMatchedError) {
          this.warn(e.message)
        } else {
          this.error(e)
        }
        return undefined
      }
    }))

    const existedCount = existedResources.filter((r) => !!r).length
    const unknownCount = allResources.filter(isNullOrUndefine).length
    const newCount = allResources.length - existedCount - unknownCount

    if (options.restrictToDomain) {
      this.log(`Resolve ${existedResources.length} resources from /${options.restrictToDomain}. Imported ${newCount} new resources, ${existedCount} resources existed, and ${unknownCount} unknown resource.`)
    } else {
      this.log(`Resolve ${existedResources.length} resources. Imported ${newCount} new resources, ${existedCount} resources existed, and ${unknownCount} unknown resource.`)
    }
    this.commitResources(allResources.filter(isNonnull))

    return allResources
  }

  async parserFile(options: ParseFileOptions): Promise<AnyResource> {
    const { path } = options
    const existed = await this.queryExistedResourceByPath(path)
    if (existed) {
      return existed
    }
    const [resource] = await this.resolveResource(options)
    return resource as AnyResource
  }

  /**
   * Import the resource into the launcher.
   * @returns The resource resolved. If the resource cannot be resolved, it will goes to unknown domain.
   */
  async importFile(options: ImportFileOptions) {
    requireString(options.path)
    const existed = await this.queryExistedResourceByPath(options.path)
    if (existed) {
      this.log(`Skip to import ${options.path} as resource existed in ${existed.path}`)
      return existed
    }
    if (await isDirectory(options.path)) {
      throw new Error(`Cannot import ${options.path} as it's a directory!`)
    }
    const task = this.importFileTask(options)
    const resource = await (options.background ? task.startAndWait() : this.submit(task))
    this.log(`Import and cache newly added resource ${resource.path}`)
    this.cache.put(resource)
    this.commit('resource', resource)
    return resource
  }

  /**
   * Export the resources into target directory. This will simply copy the resource out.
   */
  async exportResource(payload: { resources: (string | AnyResource)[]; targetDirectory: string }) {
    const { resources, targetDirectory } = payload

    const promises = [] as Array<Promise<any>>
    for (const resource of resources) {
      const res = this.normalizeResource(resource)
      if (!res) throw new Error(`Cannot find the resource ${resource}`)
      promises.push(copyPassively(res.path, join(targetDirectory, res.name + res.ext)))
    }
    await Promise.all(promises)
  }

  async queryExistedResourceByPath(path: string) {
    let result: AnyPersistedResource | undefined

    const fileStat = await stat(path)

    if (!fileStat.isDirectory()) {
      result = this.getResourceByKey(fileStat.ino)

      if (!result) {
        const sha1 = await this.worker().checksum({ path, algorithm: 'sha1' })
        result = this.getResourceByKey(sha1)
      }
    }

    return result
  }

  // bridge from dry function to `this` context

  private commitResources(resources: PersistedResource[]) {
    for (const resource of resources) {
      this.cache.put(resource as any)
    }
    this.commit('resources', resources as any)
  }

  private async resolveResource(options: ParseFileOptions) {
    const { path, type } = options
    const hash = await this.worker().checksum({ path, algorithm: 'sha1' })
    const [resolved, icon] = await this.worker().resolveResource({ path, hash, hint: type ?? '*' })
    return [resolved, icon] as const
  }

  /**
   * Resolve resource task. This will not write the resource to the cache, but it will persist the resource to disk.
   * @throws DomainMissMatchedError
   */
  private importFileTask(options: ImportFileOptions) {
    const root = this.getPath()
    return task('importResource', async () => {
      const [resolved, icon] = await this.resolveResource(options)
      if (options.restrictToDomain && resolved.domain !== options.restrictToDomain) {
        throw new DomainMissMatchedError(resolved.domain, resolved.path, resolved.type)
      }
      const result = await persistResource(resolved, root, options.source ?? {}, options.url ?? [], icon)
      return result as AnyPersistedResource
    })
  }

  protected unpersistResource(resource: PersistedResource) {
    return remove(resource, this.getPath())
  }
}
