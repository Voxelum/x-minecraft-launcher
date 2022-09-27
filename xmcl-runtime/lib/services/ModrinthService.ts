import { DownloadTask } from '@xmcl/installer'
import { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { InstallModrinthVersionResult, InstallProjectVersionOptions, ModrinthService as IModrinthService, ModrinthServiceKey, ModrinthState } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { basename, join } from 'path'
import { Client } from 'undici'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { ModrinthClient } from '../clients/ModrinthClient'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

@ExposeServiceKey(ModrinthServiceKey)
export class ModrinthService extends StatefulService<ModrinthState> implements IModrinthService {
  private client: ModrinthClient

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, ModrinthServiceKey, () => new ModrinthState())
    const dispatcher = this.networkManager.registerAPIFactoryInterceptor((origin, opts) => {
      if (origin.hostname === 'api.modrinth.com') {
        // keep alive for a long time
        return new Client(origin, { ...opts, pipelining: 6 })
      }
    })
    this.client = new ModrinthClient(dispatcher)
  }

  async searchProjects(options: SearchProjectOptions): Promise<SearchResult> {
    this.log(`Try search projects via query=${options.query} limit=${options.limit} offset=${options.offset} facets=${options.facets} query=${options.query}`)
    const result = await this.client.searchProjects(options)
    this.log(`Searched projects: hits=${result.hits.length} total_hits=${result.total_hits} offset=${result.offset} limit=${result.limit}`)
    return result
  }

  @Singleton(p => p)
  async getProject(projectId: string): Promise<Project> {
    if (projectId.startsWith('local-')) { projectId = projectId.slice('local-'.length) }
    this.log(`Try get project for project_id=${projectId}`)
    const project: Project = await this.client.getProject(projectId)
    this.log(`Got project for project_id=${projectId}`)
    return project
  }

  @Singleton(p => p)
  async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    const versions: ProjectVersion[] = await this.client.getProjectVersions(projectId)
    this.log(`Get project version for version_id=${projectId}`)
    return versions
  }

  async getProjectVersion(versionId: string): Promise<ProjectVersion> {
    const version: ProjectVersion = await this.client.getProjectVersion(versionId)
    this.log(`Get project version for version_id=${versionId}`)
    return version
  }

  @Singleton(hash => hash)
  async getLatestProjectVersion(hash: string): Promise<ProjectVersion> {
    const version: ProjectVersion = await this.client.getLatestProjectVersion(hash)
    this.log(`Get project version for hash=${hash}`)
    return version
  }

  async getTags(): Promise<{ licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }> {
    const [licenses, categories, gameVersions, modLoaders] = await Promise.all([
      this.client.getLicenseTags(),
      this.client.getCategoryTags(),
      this.client.getGameVersionTags(),
      this.client.getLoaderTags(),
    ])
    return {
      licenses,
      categories,
      gameVersions,
      modLoaders,
      environments: ['client', 'server'],
    }
  }

  @Singleton((o) => o.version.id)
  async installVersion({ version, instancePath }: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult> {
    const proj = await this.getProject(version.project_id)

    const dependencies = proj.project_type !== 'modpack'
      ? await Promise.all(version.dependencies.map(async (dep) => {
        if (dep.dependency_type === 'required') {
          const depVersion = await this.getProjectVersion(dep.version_id)
          const result = await this.installVersion({ version: depVersion })
          return result
        }
        return undefined
      }))
      : []

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

        const metadata = {
          modrinth: version
            ? {
              projectId: version.project_id,
              versionId: version.id,
              filename: file.filename,
              url: file.url,
            }
            : undefined,
        }

        const [result] = await this.resourceService.importResource({
          resources: [{
            path: destination,
            uri: urls,
            metadata,
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
