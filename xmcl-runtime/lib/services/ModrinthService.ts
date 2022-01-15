import { DownloadTask } from '@xmcl/installer'
import { getMod, getModVersion, listCategories, listGameVersion, listLicenses, listLoaders, Mod, ModVersion, SearchModOptions, SearchModResult, searchMods } from '@xmcl/modrinth'
import { installModVersionOptions, ModrinthService as IModrinthService, ModrinthServiceKey, ModrinthState, PersistedResource, ResourceState } from '@xmcl/runtime-api'
import { basename, join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { CacheDictionary } from '../util/cache'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject, StatefulService } from './Service'

@ExportService(ModrinthServiceKey)
export class ModrinthService extends StatefulService<ModrinthState, [ResourceState]> implements IModrinthService {
  private cached: undefined | { licenses: string[]; categories: string[]; gameVersions: string[]; modLoaders: string[]; environments: string[] } = undefined

  private cachedVersions = new CacheDictionary<ModVersion>(60 * 1000 * 2)
  private cachedMods = new CacheDictionary<Mod>(60 * 1000)

  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)
  }

  createState(deps: [ResourceState]): ModrinthState {
    return new ModrinthState(deps[0])
  }

  async searchMods(options: SearchModOptions): Promise<SearchModResult> {
    this.log(`Try search mods via query=${options.query} limit=${options.limit} offset=${options.offset} facets=${options.facets} version=${options.version} query=${options.query}`)
    const result = await searchMods(options)
    this.log(`Searched mods: hits=${result.hits.length} total_hits=${result.total_hits} offset=${result.offset} limit=${result.limit}`)
    return result
  }

  async getMod(modId: string): Promise<Mod> {
    if (modId.startsWith('local-')) { modId = modId.slice('local-'.length) }
    const cached = this.cachedMods.get(modId)
    if (cached) {
      return cached
    }
    this.log(`Try get mod for mod_id=${modId}`)
    const mod = await getMod(modId)
    this.cachedMods.set(modId, mod)
    this.log(`Got mod for mod_id=${modId}`)
    return mod
  }

  async getModVersion(versionId: string): Promise<ModVersion> {
    const cached = this.cachedVersions.get(versionId)
    if (cached) {
      return cached
    }
    const version: ModVersion = await this.networkManager.request.get(`https://api.modrinth.com/api/v1/version/${versionId}`).json()
    this.cachedVersions.set(versionId, version)
    this.log(`Get mod version for version_id=${versionId}`)
    return version
  }

  async getTags(): Promise<{ licenses: string[]; categories: string[]; gameVersions: string[]; modLoaders: string[]; environments: string[] }> {
    if (this.cached) {
      return this.cached
    }
    const [licenses, categories, gameVersions, modLoaders] = await Promise.all([
      listLicenses(),
      listCategories(),
      listGameVersion(),
      listLoaders(),
    ])
    this.cached = {
      licenses,
      categories,
      gameVersions,
      modLoaders,
      environments: ['client', 'server'],
    }
    return this.cached
  }

  async installModVersion({ version }: installModVersionOptions): Promise<PersistedResource<any>> {
    const res: PersistedResource[] = []
    for (const file of version.files) {
      this.log(`Try install mod version file ${file.filename} ${file.url}`)
      const destination = join(this.app.temporaryPath, basename(file.filename))
      const hashes = Object.entries(file.hashes)
      const urls = [file.url]
      if (version) {
        urls.push(`modrinth://${version.mod_id}/${version.id}`)
      }
      const resource = this.resourceService.getResource({ url: urls })
      if (resource) {
        this.log(`The modrinth file ${file.filename}(${file.url}) existed in cache!`)
        return resource
      }
      const task = new DownloadTask({
        ...this.networkManager.getDownloadBaseOptions(),
        url: file.url,
        destination,
        validator: {
          algorithm: hashes[0][0],
          hash: hashes[0][1],
        },
      }).setName('installModrinthFile')

      const promise = this.taskManager.submit(task)
      this.state.modrinthDownloadFileStart({ url: file.url, taskId: this.taskManager.getTaskUUID(task) })
      try {
        await promise
      } finally {
        this.state.modrinthDownloadFileEnd(file.url)
      }

      const result = await this.resourceService.importResource({
        path: destination,
        url: urls,
        source: {
          modrinth: version
            ? {
              modId: version.mod_id,
              versionId: version.id,
              filename: file.filename,
              url: file.url,
            }
            : undefined,
        },
        type: 'mods',
        background: true,
      })

      this.log(`Install modrinth file ${file.filename}(${file.url}) success!`)

      res.push(result)
    }

    return res[0]
  }
}
