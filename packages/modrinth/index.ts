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

/**
 * Modrinth IDs (projects, versions, users, …) are 8-character base62
 * strings (`[0-9A-Za-z]{8}`). Anything else — most commonly a leaked
 * file path stored in `resource.metadata.modrinth.versionId` after a
 * manual import — is guaranteed to round-trip through the API as a
 * 400 "Invalid character in base62 encoding". Filter such ids out at
 * the client level rather than per-caller.
 */
const MODRINTH_ID_RE = /^[0-9A-Za-z]{8}$/
function isModrinthId(id: string) {
  return MODRINTH_ID_RE.test(id)
}

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

export interface ModrinthUploadFile {
  partName: string
  fileName: string
  data: Blob
}

export const MODRINTH_DEFAULT_LICENSE_ID = 'LicenseRef-All-Rights-Reserved'

export function normalizeModrinthLicenseId(licenseId: string) {
  return licenseId === 'ARR' ? MODRINTH_DEFAULT_LICENSE_ID : licenseId
}

export interface ModrinthGalleryImageData {
  featured: boolean
  title?: string
  description?: string
  ordering?: number
}

export interface CreateModrinthProjectData {
  slug: string
  title: string
  description: string
  body: string
  client_side: 'required' | 'optional' | 'unsupported' | 'unknown'
  server_side: 'required' | 'optional' | 'unsupported' | 'unknown'
  project_type: 'modpack'
  initial_versions: string[]
  categories: string[]
  additional_categories?: string[]
  license_id: string
  license_url?: string
  status?: 'draft'
  requested_status?: string
  issues_url?: string | null
  source_url?: string | null
  wiki_url?: string | null
  discord_url?: string | null
}

export interface CreateModrinthVersionData {
  name: string
  version_number: string
  changelog?: string
  dependencies?: ProjectVersion['dependencies']
  game_versions: string[]
  version_type: 'release' | 'beta' | 'alpha'
  loaders: string[]
  featured?: boolean
  project_id: string
  status?: 'draft'
  requested_status?: string
}

export type UpdateModrinthProjectData = Partial<Omit<CreateModrinthProjectData, 'project_type' | 'initial_versions'>>
export type UpdateModrinthVersionData = Partial<Pick<CreateModrinthVersionData, 'name' | 'version_number' | 'changelog' | 'dependencies' | 'game_versions' | 'version_type' | 'loaders' | 'featured'>> & {
  status?: 'listed' | 'archived' | 'draft' | 'unlisted' | 'scheduled' | 'unknown'
  requested_status?: 'listed' | 'archived' | 'draft' | 'unlisted'
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

  async createProject(
    data: CreateModrinthProjectData,
    icon?: { fileName: string; data: Blob },
    signal?: AbortSignal,
  ): Promise<Project> {
    const url = new URL(this.baseUrl + '/v2/project')
    const body = new FormData()
    const draftProjectData = data.initial_versions.length === 0
      ? { ...data, status: 'draft' as const, requested_status: 'draft', is_draft: true }
      : data
    const projectData = {
      ...draftProjectData,
      license_id: normalizeModrinthLicenseId(draftProjectData.license_id),
    }
    body.append('data', JSON.stringify(projectData))
    if (icon) {
      body.append('icon', icon.data, icon.fileName)
    }
    const response = await this.fetch(url, {
      method: 'POST',
      headers: this.headers,
      body,
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    return await response.json() as Project
  }

  async updateProject(projectId: string, data: UpdateModrinthProjectData, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/project/${projectId}`)
    const response = await this.fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers, 'content-type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
  }

  async updateProjectIcon(projectId: string, icon: Blob, extension: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/project/${projectId}/icon`)
    url.searchParams.set('ext', extension.replace(/^\./, ''))
    const response = await this.fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers, 'content-type': icon.type || 'application/octet-stream' },
      body: icon,
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
  }

  async addProjectGalleryImage(projectId: string, image: Blob, extension: string, data: ModrinthGalleryImageData, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/project/${projectId}/gallery`)
    url.searchParams.set('ext', extension.replace(/^\./, ''))
    url.searchParams.set('featured', data.featured.toString())
    if (data.title) url.searchParams.set('title', data.title)
    if (data.description) url.searchParams.set('description', data.description)
    if (data.ordering !== undefined) url.searchParams.set('ordering', data.ordering.toString())
    const response = await this.fetch(url, {
      method: 'POST', headers: { ...this.headers, 'content-type': image.type || 'application/octet-stream' }, body: image, signal,
    })
    if (!response.ok) throw new ModerinthApiError(url.toString(), response.status, await response.text())
  }

  async updateProjectGalleryImage(projectId: string, imageUrl: string, data: Partial<ModrinthGalleryImageData>, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/project/${projectId}/gallery`)
    url.searchParams.set('url', imageUrl)
    if (data.featured !== undefined) url.searchParams.set('featured', data.featured.toString())
    if (data.title !== undefined) url.searchParams.set('title', data.title)
    if (data.description !== undefined) url.searchParams.set('description', data.description)
    if (data.ordering !== undefined) url.searchParams.set('ordering', data.ordering.toString())
    const response = await this.fetch(url, { method: 'PATCH', headers: this.headers, signal })
    if (!response.ok) throw new ModerinthApiError(url.toString(), response.status, await response.text())
  }

  async deleteProjectGalleryImage(projectId: string, imageUrl: string, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/project/${projectId}/gallery`)
    url.searchParams.set('url', imageUrl)
    const response = await this.fetch(url, { method: 'DELETE', headers: this.headers, signal })
    if (!response.ok) throw new ModerinthApiError(url.toString(), response.status, await response.text())
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

  async createVersion(
    data: CreateModrinthVersionData,
    files: ModrinthUploadFile[],
    primaryFile: string,
    signal?: AbortSignal,
  ): Promise<ProjectVersion> {
    if (files.length === 0) {
      throw new TypeError('A Modrinth version must contain at least one file')
    }
    if (!files.some((file) => file.partName === primaryFile)) {
      throw new TypeError(`Primary file part does not exist: ${primaryFile}`)
    }
    const url = new URL(this.baseUrl + '/v2/version')
    const body = new FormData()
    body.append('data', JSON.stringify({
      ...data,
      // The Modrinth API requires `dependencies` to be present even when
      // empty; omitting it (e.g. via JSON.stringify dropping `undefined`)
      // fails with "missing field `dependencies`".
      dependencies: data.dependencies ?? [],
      featured: data.featured ?? false,
      file_parts: files.map((file) => file.partName),
      primary_file: primaryFile,
    }))
    for (const file of files) {
      body.append(file.partName, file.data, file.fileName)
    }
    const response = await this.fetch(url, {
      method: 'POST',
      headers: this.headers,
      body,
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
    return await response.json() as ProjectVersion
  }

  async updateVersion(versionId: string, data: UpdateModrinthVersionData, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v2/version/${versionId}`)
    const response = await this.fetch(url, {
      method: 'PATCH',
      headers: { ...this.headers, 'content-type': 'application/json' },
      body: JSON.stringify(data),
      signal,
    })
    if (!response.ok) {
      throw new ModerinthApiError(url.toString(), response.status, await response.text())
    }
  }

  /**
   * @see https://docs.modrinth.com/#tag/versions/operation/getVersions
   */
  async getProjectVersionsById(ids: string[], signal?: AbortSignal) {
    // Modrinth version ids are 8-character base62. Callers occasionally
    // leak unrelated strings here — most notably absolute file paths
    // taken from `resource.metadata.modrinth.versionId` for mods that
    // were re-imported manually and ended up with the on-disk path in
    // that field (see telemetry `ModerinthApiError ... getProjectVersionsById`
    // with ids like `C:\\Users\\...\\oculus-mc1.20.1-1.8.0.jar`). The
    // server then rejects the whole batch with 400 "Invalid character
    // ':' in base62 encoding", losing all the *valid* ids in the same
    // batch. Filter client-side instead.
    const validIds = ids.filter((v) => typeof v === 'string' && isModrinthId(v))
    if (validIds.length === 0) return []
    const url = new URL(this.baseUrl + '/v2/versions')
    url.searchParams.append('ids', JSON.stringify(validIds))
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
