import { Category, GameVersion, License, Loader, Project, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { Dispatcher, request } from 'undici'

export class ModrinthClient {
  constructor(private dispatcher?: Dispatcher) { }

  async searchProjects(options: SearchProjectOptions, signal?: AbortSignal): Promise<SearchResult> {
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
      signal,
    })
    const result: SearchResult = await response.body.json()
    return result
  }

  async getProject(projectId: string, signal?: AbortSignal): Promise<Project> {
    if (projectId.startsWith('local-')) { projectId = projectId.slice('local-'.length) }
    const response = await request(`https://api.modrinth.com/v2/project/${projectId}`, {
      dispatcher: this.dispatcher,
      signal,
    })
    const project: Project = await response.body.json()
    return project
  }

  async getProjectVersions(projectId: string, loaders?: string[], gameVersions?: string[], featured?: boolean, signal?: AbortSignal): Promise<ProjectVersion[]> {
    const query: Record<string, any> = {}
    if (loaders) query.loaders = JSON.stringify(loaders)
    if (gameVersions) query.game_versions = JSON.stringify(gameVersions)
    if (featured !== undefined) query.featured = featured
    const response = await request(`https://api.modrinth.com/v2/project/${projectId}/version`, {
      query,
      dispatcher: this.dispatcher,
      signal,
    })
    if (response.statusCode !== 200) {
      const text = await response.body.text()
      throw new Error(text)
    }
    const versions: ProjectVersion[] = await response.body.json()
    return versions
  }

  async getProjectVersion(versionId: string, signal?: AbortSignal): Promise<ProjectVersion> {
    const response = await request(`https://api.modrinth.com/v2/version/${versionId}`, {
      dispatcher: this.dispatcher,
      signal,
    })
    const version: ProjectVersion = await response.body.json()
    return version
  }

  async getProjectVersionsById(ids: string[], signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/versions', {
      query: {
        ids: JSON.stringify(ids),
      },
      dispatcher: this.dispatcher,
      signal,
    })
    const versions: ProjectVersion[] = await response.body.json()
    return versions
  }

  async getProjectVersionsByHash(hashes: string[], signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/version_files', {
      method: 'POST',
      dispatcher: this.dispatcher,
      body: JSON.stringify({
        hashes,
        algorithm: 'sha1',
      }),
      headers: {
        'content-type': 'application/json',
      },
      signal,
    })
    const versions: Record<string, ProjectVersion> = await response.body.json()
    return versions
  }

  async getLatestProjectVersion(hash: string, signal?: AbortSignal): Promise<ProjectVersion> {
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
      signal,
    })
    const version: ProjectVersion = await response.body.json()
    return version
  }

  async getLicenseTags(signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/tag/license', {
      dispatcher: this.dispatcher,
      signal,
    })
    const result: License[] = await response.body.json()
    return result
  }

  async getCategoryTags(signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/tag/category', {
      dispatcher: this.dispatcher,
      signal,
    })
    const result: Category[] = await response.body.json()
    return result
  }

  async getGameVersionTags(signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/tag/game_version', {
      dispatcher: this.dispatcher,
      signal,
    })
    const result: GameVersion[] = await response.body.json()
    return result
  }

  async getLoaderTags(signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/tag/loader', {
      dispatcher: this.dispatcher,
      signal,
    })
    const result: Loader[] = await response.body.json()
    return result
  }
}
