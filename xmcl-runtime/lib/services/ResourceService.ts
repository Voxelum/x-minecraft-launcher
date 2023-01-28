/* eslint-disable no-dupe-class-members */
import { ExportResourceOptions, ImportResourceOptions, PartialResourceHash, ResolveResourceOptions, Resource, ResourceDomain, ResourceMetadata, ResourceService as IResourceService, ResourceServiceKey, ResourceType } from '@xmcl/runtime-api'
import { FSWatcher } from 'fs'
import { ensureDir, unlink } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { kResourceWorker, ResourceWorker } from '../entities/resourceWorker'
import {
  createResourceContext,
  generateResource, getResourceEntry,
  loadResources,
  migrateResources,
  parseMetadata, resolveDomain, ResourceContext, tryPersistResource, upsertMetadata,
  watchResources,
} from '../resourceCore'
import { copyPassively, readdirEnsured } from '../util/fs'
import { ImageStorage } from '../util/imageStore'
import { isArrayEqual } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { createPromiseSignal, PromiseSignal } from '../util/promiseSignal'
import { AbstractService, ExposeServiceKey } from './Service'

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
  private readyPromises: Partial<Record<ResourceDomain, PromiseSignal<void>>> = {
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

  private context: ResourceContext

  private installers: Partial<Record<ResourceDomain, ((resource: Resource, path: string) => Promise<void>)>> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ImageStorage) readonly imageStore: ImageStorage,
    @Inject(kResourceWorker) private worker: ResourceWorker) {
    super(app, async () => {
      const mount = async (domain: ResourceDomain) => {
        const domainPath = this.getPath(domain)
        const files = await readdirEnsured(domainPath)
        await loadResources(domainPath, files, this.context).catch(e => {
          this.error(`Fail to load resources in domain ${domain} %o`, e)
        })
        this.log(`Warmed up ${domain} resources`)
        this.watchers[domain] = watchResources(domainPath, this.context)
      }
      await migrateResources(this.getAppDataPath('resources'), this.context).catch((e) => {
        this.error('Fail to migrate the legacy resource %o', e)
      })
      for (const domain of [
        ResourceDomain.Mods,
        ResourceDomain.ResourcePacks,
        ResourceDomain.Saves,
        ResourceDomain.Modpacks,
        ResourceDomain.ShaderPacks,
        ResourceDomain.Unclassified,
      ]) {
        this.readyPromises[domain]?.accept(mount(domain))
      }

      await ensureDir(this.getAppDataPath('resource-images')).catch((e) => {
        this.error('Fail to initialize resource-images folder: %o', e)
      })
    })
    this.context = createResourceContext(this.getAppDataPath('resources-v2'), imageStore, this, this, worker)
  }

  async getResourceMetadataByHash(sha1: string): Promise<ResourceMetadata | undefined> {
    const [metadata] = await this.context.metadata.getMany([sha1])
    return metadata
  }

  async getResourcesMetadataByHashes(sha1: string[]): Promise<Array<ResourceMetadata | undefined>> {
    const metadata = await this.context.metadata.getMany(sha1)
    return metadata
  }

  async getResourcesUnder({ fileNames, domain }: { fileNames: string[]; domain: ResourceDomain }): Promise<(Resource | undefined)[]> {
    const cache = await this.context.fileNameSnapshots[domain].getMany(fileNames)
    const metadata = await this.context.metadata.getMany(cache.map(c => c?.sha1 ?? ''))
    const path = this.getPath()
    return cache.map((c, i) => !c ? undefined : generateResource(path, c, metadata[i]))
  }

  registerInstaller(domain: ResourceDomain, installer: (resource: Resource, path: string) => Promise<void>) {
    this.installers[domain] = installer
  }

  async whenReady(resourceDomain: ResourceDomain) {
    await this.readyPromises[resourceDomain]?.promise
  }

  async getResourceUnder({ fileName, domain }: { fileName: string; domain: ResourceDomain }): Promise<Resource | undefined> {
    const cache = await this.context.fileNameSnapshots[domain].get(fileName).catch(() => undefined)
    if (!cache) {
      return undefined
    }
    const metadata = await this.context.metadata.get(cache.sha1).catch(() => undefined)
    return generateResource(this.getPath(), cache, metadata)
  }

  async getResources(domain: ResourceDomain): Promise<Resource[]> {
    await this.whenReady(domain)
    const values = await this.context.fileNameSnapshots[domain].values().all()
    const metadata = await this.context.metadata.getMany(values.map(v => v.sha1))

    return values.map((v, i) => generateResource(this.getPath(), v, metadata[i]))
  }

  getResourcesByUris(uri: [string]): Promise<[Resource | undefined]>
  getResourcesByUris(uri: [string, string]): Promise<[Resource | undefined, Resource | undefined]>
  getResourcesByUris(uri: string[]): Promise<Array<Resource | undefined>>
  async getResourcesByUris(uri: string[]): Promise<Array<Resource | undefined>> {
    const hashes = await this.context.uri.getMany(uri)
    const files = await this.context.sha1Snapshot.getMany(hashes.map(h => !h ? '' : h))
    const result: Promise<Resource | undefined>[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) {
        result[i] = Promise.resolve(undefined)
      } else {
        result[i] = this.context.metadata.get(file.sha1).then(m => {
          return generateResource(this.getPath(), file, m)
        }, () => undefined)
      }
    }
    return await Promise.all(result)
  }

  async getReosurceByIno(ino: number): Promise<Resource | undefined> {
    const fileCache = await this.context.inoSnapshot.get(ino.toString()).catch(() => undefined)
    if (!fileCache) return undefined
    const metadata = await this.context.metadata.get(fileCache.sha1).catch(() => undefined)
    return generateResource(this.getPath(), fileCache, metadata)
  }

  async getResourcesByHashes(sha1: string[]): Promise<Array<Resource | undefined>> {
    sha1 = sha1.map(s => s === EMPTY_RESOURCE_SHA1 ? '' : s)
    const fileCaches = await this.context.sha1Snapshot.getMany(sha1)
    const result: Promise<Resource | undefined>[] = []
    for (let i = 0; i < fileCaches.length; i++) {
      const file = fileCaches[i]
      if (!file) {
        result[i] = Promise.resolve(undefined)
      } else {
        result[i] = this.context.metadata.get(file.sha1).then(m => {
          return generateResource(this.getPath(), file, m)
        }, () => undefined)
      }
    }
    return await Promise.all(result)
  }

  async getResourceByHash(sha1: string): Promise<Resource | undefined> {
    if (sha1 === EMPTY_RESOURCE_SHA1) return undefined
    const fileCache = await this.context.sha1Snapshot.get(sha1).catch(() => undefined)
    if (!fileCache) return undefined
    const metadata = await this.context.metadata.get(sha1).catch(() => undefined)
    return generateResource(this.getPath(), fileCache, metadata)
  }

  async removeResources(hashes: Array<string>) {
    const resources = await this.context.sha1Snapshot.getMany(hashes)
    const resourcePaths = resources.filter(r => !!r).map(r => this.getPath(r.domain, r.fileName))
    await Promise.all(resourcePaths.map(p => unlink(p)))
  }

  updateResources(resources: [PartialResourceHash, PartialResourceHash]): Promise<[string, string]>
  updateResources(resources: [PartialResourceHash]): Promise<[string]>
  updateResources(resources: PartialResourceHash[]): Promise<string[]>
  async updateResources(resources: PartialResourceHash[]): Promise<string[]> {
    const batch = this.context.metadata.batch()
    let dirty = false
    const allMetadata = await this.context.metadata.getMany(resources.map(r => r.hash))

    const updated = [] as string[]
    for (let i = 0; i < resources.length; i++) {
      const options = resources[i]
      let data = allMetadata[i]
      if (!data) {
        data = {
          name: '',
          hashes: {
            sha1: options.hash,
          },
          icons: [],
          tags: [],
          uris: [],
        }
      }
      if (options.name && options.name !== data.name) {
        data.name = options.name
        dirty = true
      }
      if (options.tags) {
        if (!isArrayEqual(options.tags, data.tags)) {
          const tags = options.tags
          data.tags = tags
          dirty = true
        }
      }
      if (options.uris) {
        data.uris = [...new Set([...options.uris, ...data.uris])]
        dirty = true
      }
      if (options.metadata?.curseforge) {
        data.curseforge = options.metadata.curseforge
        dirty = true
      }
      if (options.metadata?.modrinth) {
        data.modrinth = options.metadata.modrinth
        dirty = true
      }
      if (options.metadata?.github) {
        data.github = options.metadata.github
        dirty = true
      }
      if (options.metadata?.instance) {
        data.instance = options.metadata.instance
        dirty = true
      }
      if (options.icons) {
        data.icons = options.icons
        dirty = true
      }
      if (dirty) {
        batch.put(options.hash, data)
      }
      updated.push(options.hash)
    }
    if (dirty) {
      await batch.write()
      const snapshot = await this.context.sha1Snapshot.getMany(resources.map(r => r.hash))
      for (let i = 0; i < snapshot.length; i++) {
        const entry = snapshot[i]
        const metadata = allMetadata[i]
        if (entry && metadata) {
          this.emit('resourceUpdate', generateResource(this.getPath(), entry, metadata))
        }
      }
    } else {
      await batch.close()
    }
    return updated
  }

  resolveResources(options: [ResolveResourceOptions, ResolveResourceOptions]): Promise<[Resource, Resource]>
  resolveResources(options: [ResolveResourceOptions]): Promise<[Resource]>
  resolveResources(options: ResolveResourceOptions[]): Promise<Resource[]>
  async resolveResources(options: ResolveResourceOptions[]): Promise<Resource[]> {
    const result = await Promise.all(options.map(async ({ path, domain }) => {
      const resolved = await getResourceEntry(path, this.context)
      if ('domain' in resolved) {
        const metadata = await this.context.metadata.get(resolved.sha1).catch(() => undefined)
        return generateResource(this.getPath(), resolved, metadata, { path, domain })
      }
      const parsed = await parseMetadata(path, resolved.fileType, domain ?? ResourceDomain.Unclassified, this.context)
      const data = await upsertMetadata(parsed.metadata, parsed.uris, parsed.icons, parsed.name, resolved.sha1, this.context)

      return generateResource(this.getPath(), resolved, data, { path, domain })
    }))
    return result
  }

  importResources(resources: [ImportResourceOptions]): Promise<[Resource]>
  importResources(resources: [ImportResourceOptions, ImportResourceOptions]): Promise<[Resource, Resource]>
  importResources(resources: ImportResourceOptions[]): Promise<Resource[]>
  async importResources(options: ImportResourceOptions[]): Promise<Resource[]> {
    // We need to resolve the domain of the resource
    const resolved = await this.resolveResources(options)
    const result = await Promise.all(resolved.map(async (resolved, index) => {
      if (resolved.fileType === 'directory') {
        // Will not persist the dictionary as it cannot calculate hash
        return resolved
      }
      if (resolved.storedPath) {
        return resolved
      }

      if (resolved.domain === ResourceDomain.Unclassified) {
        resolved.domain = resolveDomain(resolved.metadata)
      }

      const option = options[index]

      if (option.metadata || option.uris || option.icons) {
        await upsertMetadata(option.metadata ?? {}, option.uris ?? [], option.icons ?? [], resolved.fileName, resolved.hash, this.context)
      }

      const storedPath = await tryPersistResource(resolved, this.getPath(), this.context)
      const resource = { ...resolved, storedPath }

      this.log(`Persist new resource ${resource.path} -> ${storedPath}`)

      return resource
    }))

    return result
  }

  async exportResources({ resources, targetDirectory }: ExportResourceOptions) {
    const promises = [] as Array<Promise<string>>
    const sha1s = resources.map(r => typeof r === 'string' ? r : r.hash)
    const entries = await this.context.sha1Snapshot.getMany(sha1s)
    for (let i = 0; i < resources.length; i++) {
      const entry = entries[i]
      if (entry) {
        const from = this.getPath(entry.domain, entry.fileName)
        const to = join(targetDirectory, entry.fileName)
        promises.push(copyPassively(from, to).then(() => to))
      }
    }
    const result = await Promise.all(promises)
    return result
  }

  async install(installOptions: { instancePath: string; resource: Resource }) {
    const { instancePath, resource } = installOptions

    const installer = this.installers[resource.domain]

    if (!installer) {
      throw new Error(`Not found the resource installer for domain ${resource.domain}`)
    }

    await installer(resource, instancePath)
  }

  async dispose(): Promise<void> {
    for (const watcher of Object.values(this.watchers)) {
      watcher?.close()
    }
    await this.context.level.close()
  }
}
