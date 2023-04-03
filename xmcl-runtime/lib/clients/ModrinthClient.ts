import type { Category, GameVersion, License, Loader, Project, TeamMember, ProjectVersion, SearchProjectOptions, SearchResult } from '@xmcl/modrinth'
import { HTTPException } from '@xmcl/runtime-api'
import { Dispatcher, request } from 'undici'
import { InMemoryTtlCache } from '../util/cache'

export interface ModrinthClientOptions {
  signal?: AbortSignal
  origin?: string
  getHeaders?: () => Promise<Record<string, string>>
  noTimeout?: boolean
}
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
      headers: {
        // 'cache-control': 'max-stale=3600',
      },
      signal,
    })
    const result: SearchResult = await response.body.json()
    return result
  }

  async getProject(projectId: string, { signal, getHeaders, noTimeout, origin = 'https://api.modrinth.com' }: ModrinthClientOptions = {}): Promise<Project> {
    if (projectId.startsWith('local-')) { projectId = projectId.slice('local-'.length) }
    // const cached = this.projectCache.get(projectId)
    // if (cached) return cached
    const response = await request(`${origin}/v2/project/${projectId}`, {
      dispatcher: this.dispatcher,
      signal,
      headers: {
        ...(await getHeaders?.() || {}),
      },
      totalTimeout: noTimeout ? 0 : undefined,
      headersTimeout: noTimeout ? 0 : undefined,
    })
    const project: Project = await response.body.json()
    // this.projectCache.put(projectId, project)
    return project
  }

  async getProjectVersions(projectId: string, loaders?: string[], gameVersions?: string[], featured?: boolean, signal?: AbortSignal): Promise<ProjectVersion[]> {
    const query: Record<string, any> = {}
    if (loaders) query.loaders = JSON.stringify(loaders)
    if (gameVersions) query.game_versions = JSON.stringify(gameVersions)
    if (featured !== undefined) query.featured = featured
    // const key = projectId + JSON.stringify(query)
    // const cached = this.versionCache.get(key)
    // if (cached) {
    //   return cached
    // }
    const response = await request(`https://api.modrinth.com/v2/project/${projectId}/version`, {
      query,
      dispatcher: this.dispatcher,
      headers: {
        // 'cache-control': 'max-stale=3600',
      },
      signal,
    })
    if (response.statusCode !== 200) {
      const text = await response.body.text()
      throw new Error(text)
    }
    const versions: ProjectVersion[] = await response.body.json()
    // this.versionCache.put(key, versions)
    return versions
  }

  async getProjectVersion(versionId: string, signal?: AbortSignal): Promise<ProjectVersion> {
    const response = await request(`https://api.modrinth.com/v2/version/${versionId}`, {
      dispatcher: this.dispatcher,
      signal,
      headers: {
        // 'cache-control': 'max-stale=3600',
      },
    })
    const version: ProjectVersion = await response.body.json()
    return version
  }

  async getProjectVersionsById(ids: string[], signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/versions', {
      query: {
        ids: JSON.stringify(ids),
      },
      headers: {
        // 'cache-control': 'max-stale=3600',
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
        // 'cache-control': 'max-stale=3600',
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
    if (response.statusCode !== 200) {
      const body = await response.body.json()
      throw new HTTPException({ type: 'httpException', statusCode: response.statusCode, method: 'POST', body, code: '', url: `https://api.modrinth.com/v2/version_file/${hash}/update` })
    }
    const version: ProjectVersion = await response.body.json()
    return version
  }

  async getLicenseTags(signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/tag/license', {
      dispatcher: this.dispatcher,
      signal,
      headers: {
        // 'cache-control': 'max-stale=86400',
      },
    })
    const result: License[] = await response.body.json()
    return result
  }

  async getCategoryTags(signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/tag/category', {
      dispatcher: this.dispatcher,
      signal,
      headers: {
        // 'cache-control': 'max-stale=86400',
      },
    })
    const result: Category[] = await response.body.json()
    return result
  }

  async getGameVersionTags(signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/tag/game_version', {
      dispatcher: this.dispatcher,
      signal,
      headers: {
        // 'cache-control': 'max-stale=86400',
      },
    })
    const result: GameVersion[] = await response.body.json()
    return result
  }

  async getLoaderTags(signal?: AbortSignal) {
    const response = await request('https://api.modrinth.com/v2/tag/loader', {
      dispatcher: this.dispatcher,
      signal,
      headers: {
        // 'cache-control': 'max-stale=86400',
      },
    })
    const result: Loader[] = await response.body.json()
    return result
  }

  async getProjectTeamMembers(projectId: string, signal?: AbortSignal) {
    const response = await request(`https://api.modrinth.com/v2/project/${projectId}/members`, {
      dispatcher: this.dispatcher,
      signal,
      headers: {
        // 'cache-control': 'max-stale=3600',
      },
    })
    const result: TeamMember[] = await response.body.json()
    return result
  }
}
