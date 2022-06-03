import { DownloadTask } from '@xmcl/installer'
import { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { InstallProjectVersionOptions, ModrinthService as IModrinthService, ModrinthServiceKey, ModrinthState, PersistedResource } from '@xmcl/runtime-api'
import { basename, join } from 'path'
import { URLSearchParams } from 'url'
import { LauncherApp } from '../app/LauncherApp'
import { PersistedInMemoryCache } from '../util/cache'
import { ResourceService } from './ResourceService'
import { Inject, StatefulService } from './Service'

export class ModrinthService extends StatefulService<ModrinthState> implements IModrinthService {
  private client = this.networkManager.request.extend({
    prefixUrl: 'https://api.modrinth.com/v2',
    cache: new PersistedInMemoryCache(this.getAppDataPath('modrinth-cache.json')),
  })

  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, ModrinthServiceKey, () => new ModrinthState())
  }

  async searchProjects(options: SearchProjectOptions): Promise<SearchResult> {
    this.log(`Try search projects via query=${options.query} limit=${options.limit} offset=${options.offset} facets=${options.facets} query=${options.query}`)
    const searchParams = new URLSearchParams([
      ['query', options.query ?? ''],
      ['filter', options.filters ?? ''],
      ['index', options.index || 'relevance'],
      ['offset', options.offset?.toString() ?? '0'],
      ['limit', options.limit?.toString() ?? '10'],
    ])
    if (options.facets) {
      searchParams.append('facets', options.facets)
    }
    const result: SearchResult = await this.client.get('search', {
      searchParams,
    }).json()
    this.log(`Searched projects: hits=${result.hits.length} total_hits=${result.total_hits} offset=${result.offset} limit=${result.limit}`)
    return result
  }

  async getProject(projectId: string): Promise<Project> {
    if (projectId.startsWith('local-')) { projectId = projectId.slice('local-'.length) }
    this.log(`Try get project for project_id=${projectId}`)
    const project: Project = await this.client.get(`project/${projectId}`).json()
    this.log(`Got project for project_id=${projectId}`)
    return project
  }

  async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    const versions: ProjectVersion[] = await this.client.get(`project/${projectId}/version`).json()
    this.log(`Get project version for version_id=${projectId}`)
    return versions
  }

  async getProjectVersion(versionId: string): Promise<ProjectVersion> {
    const version: ProjectVersion = await this.client.get(`version/${versionId}`).json()
    this.log(`Get project version for version_id=${versionId}`)
    return version
  }

  async getTags(): Promise<{ licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }> {
    const [licenses, categories, gameVersions, modLoaders] = await Promise.all([
      this.client.get('tag/license').json<License[]>(),
      this.client.get('tag/category').json<Category[]>(),
      this.client.get('tag/game_version').json<GameVersion[]>(),
      this.client.get('tag/loader').json<Loader[]>(),
    ])
    return {
      licenses,
      categories,
      gameVersions,
      modLoaders,
      environments: ['client', 'server'],
    }
  }

  async installVersion({ version }: InstallProjectVersionOptions): Promise<PersistedResource<any>> {
    const res: PersistedResource[] = []
    const proj = await this.getProject(version.project_id)
    for (const file of version.files) {
      this.log(`Try install project version file ${file.filename} ${file.url}`)
      const destination = join(this.app.temporaryPath, basename(file.filename))
      const hashes = Object.entries(file.hashes)
      const urls = [file.url]
      if (version) {
        urls.push(`modrinth://${version.project_id}/${version.id}`)
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
              projectId: version.project_id,
              versionId: version.id,
              filename: file.filename,
              url: file.url,
            }
            : undefined,
        },
        iconUrl: proj.icon_url,
        background: true,
      })

      this.log(`Install modrinth file ${file.filename}(${file.url}) success!`)

      res.push(result)
    }

    return res[0]
  }
}
