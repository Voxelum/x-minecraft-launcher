import { DownloadTask } from '@xmcl/installer'
import { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { getModrinthVersionFileUri, getModrinthVersionUri, InstallModrinthVersionResult, InstallProjectVersionOptions, ModrinthService as IModrinthService, ModrinthServiceKey } from '@xmcl/runtime-api'
import { unlink } from 'fs-extra'
import { url } from 'inspector'
import { basename, join } from 'path'
import { Pool } from 'undici'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { ModrinthClient } from '../clients/ModrinthClient'
import { isNonnull } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'

interface Tags { licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }

@ExposeServiceKey(ModrinthServiceKey)
export class ModrinthService extends AbstractService implements IModrinthService {
  readonly client: ModrinthClient

  private tags: Tags | undefined

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app, async () => {
    })
    const dispatcher = this.networkManager.registerAPIFactoryInterceptor((origin, opts) => {
      if (origin.hostname === 'api.modrinth.com') {
        // keep alive for a long time
        return new Pool(origin, { ...opts, pipelining: 6, connections: 2, bodyTimeout: 0 })
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

  @Singleton(p => JSON.stringify(p))
  async getProjectVersions({ projectId, featured }: { projectId: string; featured?: boolean }): Promise<ProjectVersion[]> {
    const versions: ProjectVersion[] = await this.client.getProjectVersions(projectId, undefined, undefined, featured)
    this.log(`Get project version for version_id=${projectId}`)
    return versions
  }

  async getProjectVersionsByHash(hashes: string[]): Promise<Record<string, ProjectVersion>> {
    const result = await this.client.getProjectVersionsByHash(hashes)
    return result
  }

  async getProjectVersionsByIds(ids: string[]) {
    const result = await this.client.getProjectVersionsById(ids)
    return result
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

  async getProjectTeamMembers(projectId: string) {
    const members = await this.client.getProjectTeamMembers(projectId)
    this.log(`Get members of the project ${projectId}`)
    return members
  }

  async getTags(): Promise<{ licenses: License[]; categories: Category[]; gameVersions: GameVersion[]; modLoaders: Loader[]; environments: string[] }> {
    if (this.tags) return this.tags
    const [licenses, categories, gameVersions, modLoaders] = await Promise.all([
      this.client.getLicenseTags(),
      this.client.getCategoryTags(),
      this.client.getGameVersionTags(),
      this.client.getLoaderTags(),
    ])
    this.tags = {
      licenses,
      categories,
      gameVersions,
      modLoaders,
      environments: ['client', 'server'],
    }
    // try {
    //   await writeFile(this.getAppDataPath('modrinth-tags.json'), JSON.stringify(this.tags))
    // } catch {

    // }
    return this.tags
  }

  async resolveDependencies(version: ProjectVersion): Promise<ProjectVersion[]> {
    const visited = new Set<string>()

    const visit = async (version: ProjectVersion): Promise<ProjectVersion[]> => {
      if (visited.has(version.project_id)) {
        return []
      }
      visited.add(version.project_id)

      const deps = await Promise.all(version.dependencies.map(async (dep) => {
        if (dep.dependency_type === 'required') {
          if (dep.version_id) {
            const depVersion = await this.getProjectVersion(dep.version_id)
            const result = await visit(depVersion)
            return result
          } else {
            const versions = await this.client.getProjectVersions(dep.project_id, version.loaders, version.game_versions, undefined)
            const result = await visit(versions[0])
            return result
          }
        }
      }))
      return [version, ...deps.filter(isNonnull).reduce((a, b) => a.concat(b), [])]
    }

    const deps = await visit(version)
    deps.shift()

    return deps
  }

  @Singleton((o) => `${o.version.id}`)
  async installVersion({ version, project: proj, instancePath, ignoreDependencies }: InstallProjectVersionOptions): Promise<InstallModrinthVersionResult> {
    const project = proj ?? await this.getProject(version.project_id)

    const dependencies = project.project_type !== 'modpack' && !ignoreDependencies
      ? await Promise.all((await this.resolveDependencies(version)).map(version => this.installVersion({ version, instancePath, ignoreDependencies: true })))
      : []

    const isSingleFile = version.files.length === 1
    const resources = await Promise.all(version.files.map(async (file) => {
      this.log(`Try install project version file ${file.filename} ${file.url}`)
      const destination = join(this.app.temporaryPath, basename(file.filename))
      const hashes = Object.entries(file.hashes)
      const urls = [file.url]
      if (version) {
        urls.push(getModrinthVersionFileUri({ project_id: version.project_id, id: version.id, filename: file.filename }))
        if (isSingleFile) {
          urls.push(getModrinthVersionUri(version))
        }
      }

      let resource = (await this.resourceService.getResourcesByUris(urls)).reduce((a, b) => a || b, undefined)
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
        }).setName('installModrinthFile', {
          projectId: version.project_id,
          versionId: version.id,
          filename: file.filename,
        })

        await this.taskManager.submit(task)
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

        const [result] = await this.resourceService.importResources([{
          path: destination,
          uris: urls,
          metadata,
          icons: project.icon_url ? [project.icon_url] : [],
        }])

        await unlink(destination).catch(() => undefined)
        this.log(`Install modrinth file ${file.filename}(${file.url}) success!`)

        resource = result
      }

      if (instancePath) {
        resource.path = resource.storedPath!
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
