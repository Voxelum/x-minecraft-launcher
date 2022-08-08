import { DownloadTask } from '@xmcl/installer'
import { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { InstallModrinthVersionResult, InstallProjectVersionOptions, ModrinthService as IModrinthService, ModrinthServiceKey, ModrinthState } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { basename, join } from 'path'
import { URLSearchParams } from 'url'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

@ExposeServiceKey(ModrinthServiceKey)
export class ModrinthService extends StatefulService<ModrinthState> implements IModrinthService {
  private client = this.networkManager.request.extend({
    prefixUrl: 'https://api.modrinth.com/v2',
  })

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
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

  @Singleton(p => p)
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

  async installVersion({ version, instancePath }: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult> {
    const proj = await this.getProject(version.project_id)

    const dependencies = await Promise.all(version.dependencies.map(async (dep) => {
      if (dep.dependency_type === 'required') {
        const depVersion = await this.getProjectVersion(dep.version_id)
        const result = await this.installVersion({ version: depVersion })
        return result
      }
      return undefined
    }))

    const resources = await Promise.all(version.files.map(async (file) => {
      this.log(`Try install project version file ${file.filename} ${file.url}`)
      const destination = join(this.app.temporaryPath, basename(file.filename))
      const hashes = Object.entries(file.hashes)
      const urls = [file.url]
      if (version) {
        urls.push(`modrinth:${version.project_id}:${version.id}`)
      }

      let resource = this.resourceService.getOneResource({ url: urls })
      if (resource) {
        this.log(`The modrinth file ${file.filename}(${file.url}) existed in cache!`)
      } else {
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

        const [result] = await this.resourceService.importResource({
          resources: [{
            path: destination,
            uri: urls,
            metadata: {
              modrinth: version
                ? {
                  projectId: version.project_id,
                  versionId: version.id,
                  filename: file.filename,
                  url: file.url,
                }
                : undefined,
            },
            icons: proj.icon_url ? [proj.icon_url] : [],
          }],
          background: true,
        })

        await unlink(destination).catch(() => undefined)
        this.log(`Install modrinth file ${file.filename}(${file.url}) success!`)

        resource = result
      }

      if (instancePath) {
        await this.resourceService.install({ instancePath, resource })
      }

      return resource
    }))

    return {
      version,
      resources,
      dependencies: dependencies.filter(isNonnull),
    }
  }
}
