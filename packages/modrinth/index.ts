/* eslint-disable n/no-unsupported-features/node-builtins */
/**
 * @module @xmcl/modrinth
 */

import {
  Category,
  Collection,
  GameVersion,
  License,
  Loader,
  Project,
  ProjectVersion,
  TeamMember,
  User,
} from './types'

export * from './types'

/* eslint-disable camelcase */
export interface SearchResultHit {
  /**
   * The slug of project, e.g. "my_project"
   */
  slug: string
  /**
   * The id of the project; prefixed with local-
   */
  project_id: string
  /**
   * The project type of the project.
   * @enum "mod" "modpack"
   * */
  project_type: string
  /**
   * The username of the author of the project
   */
  author: string
  /**
   * The name of the project.
   */
  title: string
  /**
   * A short description of the project
   */
  description: string
  /**
   * A list of the categories the project is in.
   */
  categories: Array<string>
  /**
   * A list of the minecraft versions supported by the project.
   */
  versions: Array<string>
  /**
   * The total number of downloads for the project
   */
  downloads: number

  follows: number
  /**
   * A link to the project's main page; */
  page_url: string
  /**
   * The url of the project's icon */
  icon_url: string
  /**
   * The url of the project's author */
  author_url: string
  /**
   * The date that the project was originally created
   */
  date_created: string
  /**
   * The date that the project was last modified
   */
  date_modified: string
  /**
   * The latest version of minecraft that this project supports */
  latest_version: string
  /**
   * The id of the license this project follows */
  license: string
  /**
   * The side type id that this project is on the client */
  client_side: string
  /**
   * The side type id that this project is on the server */
  server_side: string
  /**
   * The host that this project is from, always modrinth */
  host: string

  gallery: string[]

  featured_gallery: string

  monetization_status: string
}

export interface SearchProjectOptions {
  /**
   * The query to search
   */
  query?: string
  /**
   * The recommended way of filtering search results. [Learn more about using facets](https://docs.modrinth.com/docs/tutorials/search).
   *
   * @enum "categories" "versions" "license" "project_type"
   * @example [["categories:forge"],["versions:1.17.1"],["project_type:mod"]]
   */
  facets?: string
  /**
   * A list of filters relating to the properties of a project. Use filters when there isn't an available facet for your needs. [More information](https://docs.meilisearch.com/reference/features/filtering.html)
   *
   * @example filter=categories="fabric" AND (categories="technology" OR categories="utility")
   */
  filter?: string
  /**
   * What the results are sorted by
   *
   * @enum "relevance" "downloads" "follows" "newest" "updated"
   * @example "downloads"
   * @default relevance
   */
  index?: string
  /**
   * The offset into the search; skips this number of results
   * @default 0
   */
  offset?: number
  /**
   * The number of mods returned by the search
   * @default 10
   */
  limit?: number
}

export interface SearchResult {
  /**
   * The list of results
   */
  hits: Array<SearchResultHit>
  /**
   * The number of results that were skipped by the query
   */
  offset: number
  /**
   * The number of mods returned by the query
   */
  limit: number
  /**
   * The total number of mods that the query found
   */
  total_hits: number
}

export interface GetProjectVersionsOptions {
  id: string
  loaders?: Array<string>
  /**
   * Minecraft version filtering
   */
  game_versions?: Array<string>
  featured?: boolean
}

export class ModerinthApiError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`Fail to fetch modrinth api ${url}. Status=${status}. ${body}`)
    this.name = 'ModerinthApiError'
  }
}

export interface ModrinthClientOptions {
  baseUrl?: string
  /**
   * The extra headers
   */
  headers?: Record<string, string>
  /**
   * The fetch function to use
   */
  fetch?: typeof fetch
}

/**
 * @see https://docs.modrinth.com/api-spec
 */
export class ModrinthV2Client {
  private baseUrl: string
  private fetch: typeof fetch
  headers: Record<string, string>

  constructor(options?: ModrinthClientOptions) {
    this.baseUrl = options?.baseUrl ?? 'https://api.modrinth.com'
    this.headers = options?.headers || {}
    this.fetch = options?.fetch || ((...args) => fetch(...args))
  }

  /**
   * @see https://docs.modrinth.com/#tag/projects/operation/searchProjects
   */
  async searchProjects(options: SearchProjectOptions, signal?: AbortSignal): Promise<SearchResult> {
    const url = new URL(this.baseUrl + '/v2/search')
    url.searchParams.append('query', options.query || '')
    url.searchParams.append('filter', options.filter || '')
    url.searchParams.append('index', options.index || (options.query ? 'relevance' : 'downloads'))
    url.searchParams.append('offset', options.offset?.toString() ?? '0')
    url.searchParams.append('limit', options.limit?.toString() ?? '10')
    if (options.facets) {
      url.searchParams.append('facets', options.facets)
    }
    const response = await this.fetch(url, {
      signal,
      headers: this.headers,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as SearchResult
    return result
  }

  /**
   * @see https://docs.modrinth.com/#tag/projects/operation/getProject
   */
  async getProject(projectId: string, signal?: AbortSignal): Promise<Project> {
    if (projectId.startsWith('local-')) {
      projectId = projectId.slice('local-'.length)
    }
    const url = new URL(this.baseUrl + `/v2/project/${projectId}`)
    const response = await this.fetch(url, {
      signal,
      headers: this.headers,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const project = (await response.json()) as Project
    return project
  }

  /**
   * @see https://docs.modrinth.com/#tag/projects/operation/getProject
   */
  async getProjects(projectIds: string[], signal?: AbortSignal): Promise<Project[]> {
    const url = new URL(this.baseUrl + '/v2/projects')
    url.searchParams.append('ids', JSON.stringify(projectIds))
    const response = await this.fetch(url, {
      signal,
      headers: this.headers,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const project = (await response.json()) as Project[]
    return project
  }

  /**
   * @see https://docs.modrinth.com/#tag/versions/operation/getProjectVersions
   */
  async getProjectVersions(
    projectId: string,
    {
      loaders,
      gameVersions,
      featured,
    }: { loaders?: string[]; gameVersions?: string[]; featured?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<ProjectVersion[]> {
    const url = new URL(this.baseUrl + `/v2/project/${projectId}/version`)
    if (loaders) {
      url.searchParams.append('loaders', JSON.stringify(loaders))
    }
    if (gameVersions) {
      url.searchParams.append('game_versions', JSON.stringify(gameVersions))
    }
    if (featured !== undefined) {
      url.searchParams.append('featured', featured ? 'true' : 'false')
    }
    const response = await this.fetch(url, {
      signal,
      headers: this.headers,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const versions = (await response.json()) as ProjectVersion[]
    return versions
  }

  /**
   * @see https://docs.modrinth.com/#tag/versions/operation/getVersion
   */
  async getProjectVersion(versionId: string, signal?: AbortSignal): Promise<ProjectVersion> {
    const url = new URL(this.baseUrl + `/v2/version/${versionId}`)
    const response = await this.fetch(url, {
      signal,
      headers: this.headers,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const version = (await response.json()) as ProjectVersion
    return version
  }

  /**
   * @see https://docs.modrinth.com/#tag/versions/operation/getVersions
   */
  async getProjectVersionsById(ids: string[], signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v2/versions')
    url.searchParams.append('ids', JSON.stringify(ids))
    const response = await this.fetch(url, {
      signal,
      headers: this.headers,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const versions = (await response.json()) as ProjectVersion[]
    return versions
  }

  /**
   * @see https://docs.modrinth.com/#tag/version-files/operation/versionsFromHashes
   */
  async getProjectVersionsByHash(hashes: string[], algorithm = 'sha1', signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v2/version_files')
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        hashes,
        algorithm,
      }),
      headers: {
        ...this.headers,
        'content-type': 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const versions = (await response.json()) as Record<string, ProjectVersion>
    return versions
  }

  /**
   * @see https://docs.modrinth.com/api/operations/versionfromhash/
   */
  async getProjectVersionByHash(hash: string, { algorithm = 'sha1', multiple = false }: { algorithm?: string; multiple?: boolean } = {}, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v2/version_file/' + hash)
    url.searchParams.append('algorithm', algorithm)
    url.searchParams.append('multiple', multiple ? 'true' : 'false')
    const response = await this.fetch(url, {
      method: 'GET',
      headers: {
        ...this.headers,
        'content-type': 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const versions = await response.json() as ProjectVersion
    return versions
  }

  /**
   * @see https://docs.modrinth.com/api-spec#tag/version-files/operation/getLatestVersionsFromHashes
   */
  async getLatestVersionsFromHashes(
    hashes: string[],
    {
      algorithm,
      loaders = [],
      gameVersions = [],
    }: { algorithm?: string; loaders?: string[]; gameVersions?: string[] } = {},
    signal?: AbortSignal,
  ) {
    const url = new URL(this.baseUrl + '/v2/version_files/update')
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        hashes,
        algorithm,
        loaders,
        game_versions: gameVersions,
      }),
      headers: { ...this.headers, 'content-type': 'application/json' },
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const versions = (await response.json()) as Record<string, ProjectVersion>
    return versions
  }

  /**
   * @see https://docs.modrinth.com/#tag/version-files/operation/getLatestVersionFromHash
   */
  async getLatestProjectVersion(
    sha1: string,
    {
      algorithm,
      loaders = [],
      gameVersions = [],
    }: { algorithm?: string; loaders?: string[]; gameVersions?: string[] } = {},
    signal?: AbortSignal,
  ): Promise<ProjectVersion> {
    const url = new URL(this.baseUrl + `/v2/version_file/${sha1}/update`)
    url.searchParams.append('algorithm', algorithm ?? 'sha1')
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        loaders,
        game_versions: gameVersions,
      }),
      headers: { ...this.headers, 'content-type': 'application/json' },
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const version = (await response.json()) as ProjectVersion
    return version
  }

  /**
   * @see https://docs.modrinth.com/#tag/tags/operation/licenseList
   */
  async getLicenseTags(signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v2/tag/license')
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as License[]
    return result
  }

  /**
   * @see https://docs.modrinth.com/#tag/tags/operation/categoryList
   */
  async getCategoryTags(signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v2/tag/category')
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as Category[]
    return result
  }

  /**
   * @see https://docs.modrinth.com/#tag/tags/operation/versionList
   */
  async getGameVersionTags(signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v2/tag/game_version')
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as GameVersion[]
    return result
  }

  /**
   * @see https://docs.modrinth.com/#tag/tags/operation/loaderList
   */
  async getLoaderTags(signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v2/tag/loader')
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as Loader[]
    return result
  }

  async getCollections(userId: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v3/user/${userId}/collections`)
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as Collection[]
    return result
  }

  async uppdateCollectionIcon(
    collectionId: string,
    iconData: ArrayBuffer,
    mimeType: string,
    signal?: AbortSignal,
  ) {
    const ext = mimeType.split('/')[1]
    const url = new URL(this.baseUrl + `/v3/collection/${collectionId}/icon?ext=${ext}`)
    const response = await this.fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.headers,
        'content-type': mimeType,
      },
      body: iconData,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
  }

  async createCollection(
    name: string,
    description: string,
    projectIds: string[],
    signal?: AbortSignal,
  ) {
    const url = new URL(this.baseUrl + '/v3/collection')
    const body = JSON.stringify(
      {
        name,
        description,
        projects: projectIds,
      },
      (key, value) => (!value ? undefined : value),
    )
    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers,
        'content-type': 'application/json',
      },
      body,
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as Collection
    return result
  }

  async updateCollection(collectionId: string, projectIds: string[], signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v3/collection/${collectionId}`)
    const response = await this.fetch(url, {
      method: 'PATCH',
      headers: {
        ...this.headers,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ new_projects: projectIds }),
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
  }

  async getAuthenticatedUser(signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v2/user')
    const response = await this.fetch(url, {
      headers: this.headers,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as User
    return result
  }

  /**
   * @see https://docs.modrinth.com/api/operations/followproject/#_top
   */
  async followProject(id: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/project/${id}/follow`)
    const response = await this.fetch(url, {
      method: 'POST',
      headers: this.headers,
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
  }

  /**
   * @see https://docs.modrinth.com/api/operations/unfollowproject/
   */
  async unfollowProject(id: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/project/${id}/follow`)
    const response = await this.fetch(url, {
      method: 'DELETE',
      headers: this.headers,
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
  }

  /**
   * @see https://docs.modrinth.com/api/operations/getfollowedprojects/#_top
   */
  async getUserFollowedProjects(userId: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/user/${userId}/follows`)
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as Project[]
    return result
  }

  /**
   * @see https://docs.modrinth.com/#tag/teams/operation/getProjectTeamMembers
   */
  async getProjectTeamMembers(projectId: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/project/${projectId}/members`)
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as TeamMember[]
    return result
  }

  /**
   * @see https://docs.modrinth.com/#tag/users/operation/getUser
   */
  async getUser(id: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/user/${id}`)
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as User
    return result
  }

  /**
   * @see https://docs.modrinth.com/#tag/users/operation/getUserProjects
   */
  async getUserProjects(id: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/user/${id}/projects`)
    const response = await this.fetch(url, {
      headers: this.headers,
      signal,
    })
    if (response.status !== 200) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as Project[]
    return result
  }
}
