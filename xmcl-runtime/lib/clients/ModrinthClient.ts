import { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { Dispatcher, request } from 'undici'

export class ModrinthClient {
  constructor(private dispatcher?: Dispatcher) { }

  async searchProjects(options: SearchProjectOptions): Promise<SearchResult> {
    const query: Record<string, string | number> = {
      query: options.query ?? '',
      filter: options.filters ?? '',
      index: options.index || 'relevance',
      offset: options.offset ?? '0',
      limit: options.limit ?? '10',
    }
    if (options.facets) {
      query.facets = options.facets
    }
    const response = await request('https://api.modrinth.com/v2/search', {
      query,
      dispatcher: this.dispatcher,
    })
    const result: SearchResult = await response.body.json()
    return result
  }

  async getProject(projectId: string): Promise<Project> {
    if (projectId.startsWith('local-')) { projectId = projectId.slice('local-'.length) }
    const response = await request(`https://api.modrinth.com/v2/project/${projectId}`, {
      dispatcher: this.dispatcher,
    })
    const project: Project = await response.body.json()
    return project
  }

  async getProjectVersions(projectId: string): Promise<ProjectVersion[]> {
    const response = await request(`https://api.modrinth.com/v2/project/${projectId}/version`, {
      dispatcher: this.dispatcher,
    })
    const versions: ProjectVersion[] = await response.body.json()
    return versions
  }

  async getProjectVersion(versionId: string): Promise<ProjectVersion> {
    const response = await request(`https://api.modrinth.com/v2/version/${versionId}`, {
      dispatcher: this.dispatcher,
    })
    const version: ProjectVersion = await response.body.json()
    return version
  }

  async getLatestProjectVersion(hash: string): Promise<ProjectVersion> {
    const response = await request(`https://api.modrinth.com/v2/version_file/${hash}/update`, {
      method: 'POST',
      query: {
        algorithm: 'sha1',
      },
      body: JSON.stringify({
        loaders: [],
        game_versions: [],
      }),
      headers: { 'content-type': 'application/json' },
      dispatcher: this.dispatcher,
    })
    const version: ProjectVersion = await response.body.json()
    return version
  }

  async getLicenseTags() {
    const response = await request('https://api.modrinth.com/v2/tag/license')
    const result: License[] = await response.body.json()
    return result
  }

  async getCategoryTags() {
    const response = await request('https://api.modrinth.com/v2/tag/category')
    const result: Category[] = await response.body.json()
    return result
  }

  async getGameVersionTags() {
    const response = await request('https://api.modrinth.com/v2/tag/game_version')
    const result: GameVersion[] = await response.body.json()
    return result
  }

  async getLoaderTags() {
    const response = await request('https://api.modrinth.com/v2/tag/loader')
    const result: Loader[] = await response.body.json()
    return result
  }
}
