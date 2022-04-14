import { DownloadTask } from '@xmcl/installer'
import { getProject, listCategories, listGameVersion, listLicenses, listLoaders, Project, ProjectVersion, SearchProjectOptions, SearchResult, searchProjects, getProjectVersions, getProjectVersion, License, Category, GameVersion, Loader } from '@xmcl/modrinth'
import { InstallProjectVersionOptions, ModrinthService as IModrinthService, ModrinthServiceKey, ModrinthState, PersistedResource } from '@xmcl/runtime-api'
import { basename, join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { CacheDictionary } from '../util/cache'
import ResourceService from './ResourceService'
import { Inject, StatefulService } from './Service'

export class ModrinthService extends StatefulService<ModrinthState> implements IModrinthService {
  private cached: undefined | { licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] } = undefined

  private cachedVersions = new CacheDictionary<ProjectVersion>(60 * 1000 * 2)
  private cachedProjectVersions = new CacheDictionary<ProjectVersion[]>(60 * 1000 * 2)
  private cachedProjects = new CacheDictionary<Project>(60 * 1000)

  constructor(app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, ModrinthServiceKey, () => new ModrinthState())
  }

  async searchProjects(options: SearchProjectOptions): Promise<SearchResult> {
    this.log(`Try search projects via query=${options.query} limit=${options.limit} offset=${options.offset} facets=${options.facets} query=${options.query}`)
    const result = await searchProjects(options, this.networkManager.agents.https)
    this.log(`Searched projects: hits=${result.hits.length} total_hits=${result.total_hits} offset=${result.offset} limit=${result.limit}`)
    return result
  }

  async getProject(projectId: string): Promise<Project> {
    if (projectId.startsWith('local-')) { projectId = projectId.slice('local-'.length) }
    const cached = this.cachedProjects.get(projectId)
    if (cached) {
      return cached
    }
    this.log(`Try get project for project_id=${projectId}`)
    const project = await getProject(projectId, this.networkManager.agents.https)
    this.cachedProjects.set(projectId, project)
    this.log(`Got project for project_id=${projectId}`)
    return project
  }

  async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    const cached = this.cachedProjectVersions.get(projectId)
    if (cached) {
      return cached
    }
    const versions = await getProjectVersions(projectId, this.networkManager.agents.https)
    this.cachedProjectVersions.set(projectId, versions)
    this.log(`Get project version for version_id=${projectId}`)
    return versions
  }

  async getProjectVersion(versionId: string): Promise<ProjectVersion> {
    const cached = this.cachedVersions.get(versionId)
    if (cached) {
      return cached
    }
    const version: ProjectVersion = await getProjectVersion(versionId, this.networkManager.agents.https)
    this.cachedVersions.set(versionId, version)
    this.log(`Get project version for version_id=${versionId}`)
    return version
  }

  async getTags(): Promise<{ licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }> {
    if (this.cached) {
      return this.cached
    }
    const [licenses, categories, gameVersions, modLoaders] = await Promise.all([
      listLicenses(this.networkManager.agents.https),
      listCategories(this.networkManager.agents.https),
      listGameVersion(this.networkManager.agents.https),
      listLoaders(this.networkManager.agents.https),
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

  async installVersion({ version }: InstallProjectVersionOptions): Promise<PersistedResource<any>> {
    const res: PersistedResource[] = []
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
        type: 'mods',
        background: true,
      })

      this.log(`Install modrinth file ${file.filename}(${file.url}) success!`)

      res.push(result)
    }

    return res[0]
  }
}
