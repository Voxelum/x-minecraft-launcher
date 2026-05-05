/* eslint-disable n/no-unsupported-features/node-builtins */
/**
 * @module @xmcl/curseforge
 */

export interface ModAsset {
  id: number
  modId: number
  title: string
  description: string
  thumbnailUrl: string
  url: string
}

export const enum ModStatus {
  New = 1,
  ChangesRequired = 2,
  UnderSoftReview = 3,
  Approved = 4,
  Rejected = 5,
  ChangesMade = 6,
  Inactive = 7,
  Abandoned = 8,
  Deleted = 9,
  UnderReview = 10,
}
export const enum FileReleaseType {
  Release = 1,
  Beta = 2,
  Alpha = 3,
}

export const enum FileModLoaderType {
  Any = 0,
  Forge = 1,
  Cauldron = 2,
  LiteLoader = 3,
  Fabric = 4,
  Quilt = 5,
  NeoForge = 6,
}
export interface FileIndex {
  gameVersion: string
  fileId: number
  filename: string
  releaseType: FileReleaseType

  gameVersionTypeId: number | null
  modLoader: FileModLoaderType
}

export interface Mod {
  /**
   * The addon id. You can use this in many functions required the `addonID`
   */
  id: number
  /**
   * Game id. Minecraft is 432.
   */
  gameId: number
  /**
   * The display name of the addon
   */
  name: string
  /**
   * The mod slug that would appear in the URL
   */
  slug: string
  /** Relevant links for the mod such as Issue tracker and Wiki */
  links: {
    websiteUrl: string
    wikiUrl: string
    issuesUrl: string
    sourceUrl: string
  }
  /**
   * One line summery
   */
  summary: string
  /**
   * Current mod status
   */
  status: ModStatus
  /**
   * Number of downloads for the mod
   */
  downloadCount: number
  /**
   * Whether the mod is included in the featured mods list
   */
  isFeatured: boolean
  /**
   * The main category of the mod as it was chosen by the mod author
   */
  primaryCategoryId: number
  /**
   * List of categories that this mod is related to
   */
  categories: ModCategory[]
  /**
   * The class id this mod belongs to
   */
  classId: number | null
  /**
   * The list of authors
   */
  authors: Author[]

  logo: ModAsset

  screenshots: ModAsset[]
  /**
   * The id of the main file of the mod
   */
  mainFileId: number
  latestFiles: File[]
  /**
   * List of file related details for the latest files of the mod
   */
  latestFilesIndexes: FileIndex[]
  /**
   * The creation date of the mod
   */
  dateCreated: string

  dateModified: string
  dateReleased: string

  /**
   * Is mod allowed to be distributed
   */
  allowModDistribution: boolean | null
  /**
   * The mod popularity rank for the game
   */
  gamePopularityRank: number
  /**
   * Is the mod available for search. This can be false when a mod is experimental, in a deleted state or has only alpha files
   */
  isAvailable: boolean

  /**
   * The default download file id
   */
  defaultFileId: number
  /**
   * The mod's thumbs up count
   */
  thumbsUpCount: number
}

export interface GameVersionLatestFile {
  gameVersion: string
  projectFileId: number
  projectFileName: string
  fileType: number
}

export interface CategorySection {
  id: number
  gameId: number
  name: string
  packageType: number
  path: string
  initialInclusionPattern: string
  extraIncludePattern?: any
  gameCategoryId: number
}
export const enum HashAlgo {
  Sha1 = 1,
  Md5 = 2,
}
export interface FileHash {
  algo: HashAlgo
  value: string
}

export const enum FileStatus {
  Processing = 1,
  ChangesRequired = 2,
  UnderReview = 3,
  Approved = 4,
  Rejected = 5,
  MalwareDetected = 6,
  Deleted = 7,
  Archived = 8,
  Testing = 9,
  Released = 10,
  ReadyForReview = 11,
  Deprecated = 12,
  Baking = 13,
  AwaitingPublishing = 14,
  FailedPublishing = 15,
}

export const enum FileRelationType {
  EmbeddedLibrary = 1,
  OptionalDependency = 2,
  RequiredDependency = 3,
  Tool = 4,
  Incompatible = 5,
  Include = 6,
}

export interface FileDependency {
  modId: number
  relationType: FileRelationType
}

export interface File {
  /**
   * The fileID
   */
  id: number
  /**
   * The game id related to the mod that this file belongs to
   */
  gameId: number
  /**
   * The projectId (addonId)
   */
  modId: number
  /**
   * Whether the file is available to download
   */
  isAvailable: boolean
  /**
   * Display name
   */
  displayName: string
  /**
   * File name. Might be the same with `displayName`
   */
  fileName: string
  /**
   * Release or type.
   * - `1` is the release
   * - `2` beta
   * - `3` alpha
   */
  releaseType: number

  fileStatus: FileStatus

  hashes: FileHash[]

  fileFingerprint: number

  /**
   * The date of this file uploaded
   */
  fileDate: string
  /**
   * # bytes of this file.
   */
  fileLength: number

  /**
   * Number of downloads for the mod
   */
  downloadCount: number

  /**
   * Url to download
   */
  downloadUrl?: string
  /**
   * Game version string array, like `["1.12.2"]`
   */
  gameVersions: string[]
  /**
   * Metadata used for sorting by game versions
   */
  isAlternate: boolean
  alternateFileId: number
  dependencies: FileDependency[]
  /**
   * What files inside?
   */
  modules: Module[]
  sortableGameVersions?: SortableGameVersion[]
}

export interface SortableGameVersion {
  gameVersionPadded: string
  gameVersion: string
  gameVersionReleaseDate: string
  gameVersionName: string
}

/**
 * Represent a file in a `File`.
 */
export interface Module {
  /**
   * Actually the file name, not the folder
   */
  name: string
  /**
   * A number represent fingerprint
   */
  fingerprint: number
  type: number
}

/**
 * The author info
 */
export interface Author {
  /**
   * The project id of this query
   */
  projectId: number
  projectTitleId?: any
  projectTitleTitle?: any

  /**
   * Display name of the author
   */
  name: string
  /**
   * The full url of author homepage in curseforge
   */
  url: string
  /**
   * The id of this author
   */
  id: number
  userId: number
  twitchId: number
}

export interface ModCategory {
  /**
   * The category id
   */
  id: number
  gameId: number
  name: string
  slug: string
  url: string
  iconUrl: string
  dateModified: string
  /**
   * A top level category for other categories
   */
  isClass: boolean | null
  /**
   * The class id of the category, meaning - the class of which this category is under
   */
  classId: number | null
  /**
   * The parent category for this category
   */
  parentCategoryId: number | null
  /**
   * The display index for this category
   */
  displayIndex: number | null
}

/**
 * The search options of the search API.
 *
 * @see {@link searchMods}
 */
export interface SearchOptions {
  /**
   * The category section id, which is also a category id.
   * You can fetch if from `getCategories`.
   *
   * To get available categories, you can:
   *
   * ```ts
   * const cat = await getCategories();
   * const sectionIds = cat
   *  .filter(c => c.gameId === 432) // 432 is minecraft game id
   *  .filter(c => c.rootGameCategoryId === null).map(c => c.id);
   * // the sectionIds is all normal sections here
   * ```
   *
   * @see {@link getCategories}
   */
  classId?: number
  /**
   * This is actually the sub category id of the `sectionId`. All the numbers for this should also be fetch by `getCategories`.
   *
   * To get available values, you can:
   *
   * ```ts
   * const cat = await getCategories();
   * const sectionId = 6; // the mods
   * const categoryIds = cat
   *  .filter(c => c.gameId === 432) // 432 is minecraft game id
   *  .filter(c => c.rootGameCategoryId === sectionId) // only under the section id
   *  .map(c => c.id);
   * // Use categoryIds' id to search under the corresponding section id.
   * ```
   *
   * @see {@link getCategories}
   */
  categoryId?: number
  /**
   * The game id. The Minecraft is 432.
   *
   * @default 432
   */
  gameId?: number
  /**
   * The game version. For Minecraft, it should looks like 1.12.2.
   */
  gameVersion?: string
  /**
   * The index of the addon, NOT the page!
   *
   * When your page size is 25, if you want to get next page contents, you should have index = 25 to get 2nd page content.
   *
   * @default 0
   */
  index?: number
  /**
   * Filter by ModsSearchSortField enumeration
   */
  sortField?: ModsSearchSortField
  /**
   * 'asc' if sort is in ascending order, 'desc' if sort is in descending order
   */
  sortOrder?: 'asc' | 'desc'
  /**
   * Filter only mods associated to a given modloader (Forge, Fabric ...). Must be coupled with gameVersion.
   */
  modLoaderType?: FileModLoaderType

  modLoaderTypes?: string[]
  /**
   * Filter only mods that contain files tagged with versions of the given gameVersionTypeId
   */
  gameVersionTypeId?: number
  /**
   * Filter by slug (coupled with classId will result in a unique result).
   */
  slug?: string
  /**
   * The page size, or the number of the addons in a page.
   *
   * @default 25
   */
  pageSize?: number
  /**
   * The keyword of search. If this is absent, it just list out the available addons by `sectionId` and `categoryId`.
   */
  searchFilter?: string
}

export const enum ModsSearchSortField {
  Featured = 1,
  Popularity = 2,
  LastUpdated = 3,
  Name = 4,
  Author = 5,
  TotalDownloads = 6,
  Category = 7,
  GameVersion = 8,
}

/**
 * The options to query
 */
export interface QueryOption {
  /**
   * Additional header
   */
  headers?: Record<string, any>
  /**
   * override the http client
   */
  client?: (
    url: string,
    options: QueryOption,
    body?: object,
    text?: boolean,
  ) => Promise<object | string>
}

export interface GetModFilesOptions {
  modId: number
  gameVersion?: string
  modLoaderType?: FileModLoaderType
  /**
   * Filter only files that are tagged with versions of the given gameVersionTypeId
   */
  gameVersionTypeId?: number
  index?: number
  pageSize?: number
}

export interface Pagination {
  /**
   * A zero based index of the first item that is included in the response
   */
  index: number
  /**
   * The requested number of items to be included in the response
   */
  pageSize: number
  /**
   * The actual number of items that were included in the response
   */
  resultCount: number
  /**
   * The total number of items available by the fetch
   */
  totalCount: number
}

export interface CurseforgeClientOptions {
  /**
   * Extra headers
   */
  headers?: Record<string, string>
  /**
   * The base url, the default is `https://api.curseforge.com`
   */
  baseUrl?: string
  /**
   * The fetch function to use. The default is `fetch`
   */
  fetch?: typeof fetch
}

export interface FingerprintMatch {
  /**
   * The mod id
   */
  id: number
  file: File
  latestFiles: File[]
}
export interface FingerprintsMatchesResult {
  data: {
    isCacheBuilt: boolean
    exactMatches: FingerprintMatch[]
    exactFingerprints: number[]
    partialMatches: FingerprintMatch[]
    partialFingerprints: object
    unmatchedFingerprints: number[]
  }
}

export interface FingerprintFuzzyMatch {
  id: number
  file: File
  latestFiles: File[]
  fingerprints: number[]
}

export interface FingerprintFuzzyMatchResult {
  data: {
    fuzzyMatches: FingerprintFuzzyMatch[]
  }
}

export class CurseforgeApiError extends Error {
  constructor(
    readonly url: string,
    readonly status: number,
    readonly body: string,
  ) {
    super(`Fail to fetch curseforge api ${url}. Status=${status}. ${body}`)
    this.name = 'CurseforgeApiError'
  }
}

/**
 * Reference the https://docs.curseforge.com/#curseforge-core-api-mods
 */
export class CurseforgeV1Client {
  headers: Record<string, string>
  private fetch: typeof fetch
  private baseUrl: string

  constructor(
    private apiKey: string,
    options?: CurseforgeClientOptions,
  ) {
    this.headers = {
      'x-api-key': this.apiKey,
      ...options?.headers,
    }
    this.baseUrl = options?.baseUrl || 'https://api.curseforge.com'
    this.fetch = options?.fetch || ((...args) => fetch(...args))
  }

  /**
   * @see https://docs.curseforge.com/#get-categories
   */
  async getCategories(signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v1/categories')
    url.searchParams.append('gameId', '432')
    const response = await this.fetch(url, {
      headers: {
        ...this.headers,
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const categories = (await response.json()) as { data: ModCategory[] }
    return categories.data
  }

  /**
   * Get the mod by mod Id.
   * @see https://docs.curseforge.com/#get-mod
   * @param modId The id of mod
   * @param options The query options
   */
  async getMod(modId: number, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v1/mods/${modId}`)
    const response = await this.fetch(url, {
      headers: {
        accept: 'application/json',
        ...this.headers,
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as { data: Mod }
    return result.data
  }

  /**
   * @see https://docs.curseforge.com/#get-mod-description
   */
  async getModDescription(modId: number, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v1/mods/${modId}/description`)
    const response = await this.fetch(url, {
      headers: {
        ...this.headers,
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as { data: string }
    return result.data
  }

  /**
   * @see https://docs.curseforge.com/#get-mod-files
   */
  async getModFiles(options: GetModFilesOptions, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v1/mods/${options.modId}/files`)
    url.searchParams.append('gameVersion', options.gameVersion ?? '')
    if (options.modLoaderType !== undefined) {
      url.searchParams.append('modLoaderType', options.modLoaderType?.toString() ?? '')
    }
    url.searchParams.append('gameVersionTypeId', options.gameVersionTypeId?.toString() ?? '')
    url.searchParams.append('index', options.index?.toString() ?? '')
    url.searchParams.append('pageSize', options.pageSize?.toString() ?? '')
    const response = await this.fetch(url, {
      headers: {
        ...this.headers,
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as { data: File[]; pagination: Pagination }
    return result
  }

  /**
   * @see https://docs.curseforge.com/#curseforge-core-api-files
   */
  async getModFile(modId: number, fileId: number, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v1/mods/${modId}/files/${fileId}`)
    const response = await this.fetch(url, {
      headers: {
        ...this.headers,
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as { data: File }
    return result.data
  }

  /**
   * @see https://docs.curseforge.com/#get-mods
   */
  async getMods(modIds: number[], signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v1/mods')
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ modIds }),
      headers: {
        ...this.headers,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as { data: Mod[] }
    return result.data
  }

  /**
   * @see https://docs.curseforge.com/#get-files
   */
  async getFiles(fileIds: number[], signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v1/mods/files')
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
      headers: {
        ...this.headers,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as { data: File[] }
    return result.data
  }

  /**
   * @see https://docs.curseforge.com/#search-mods
   */
  async searchMods(options: SearchOptions, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + '/v1/mods/search')
    url.searchParams.append('gameId', '432')
    if (options.classId) {
      url.searchParams.append('classId', options.classId.toString())
    }
    if (options.categoryId) {
      url.searchParams.append('categoryId', options.categoryId.toString())
    }
    if (options.gameVersion) {
      url.searchParams.append('gameVersion', options.gameVersion)
    }
    if (options.searchFilter) {
      url.searchParams.append('searchFilter', options.searchFilter)
    }
    url.searchParams.append(
      'sortField',
      options.sortField?.toString() ?? ModsSearchSortField.Popularity.toString(),
    )
    url.searchParams.append('sortOrder', options.sortOrder ?? 'desc')
    if (options.modLoaderType) {
      url.searchParams.append('modLoaderType', options.modLoaderType.toString())
    }
    if (options.modLoaderTypes) {
      url.searchParams.append('modLoaderTypes', '[' + options.modLoaderTypes.join(',') + ']')
    }
    if (options.gameVersionTypeId) {
      url.searchParams.append('gameVersionTypeId', options.gameVersionTypeId.toString())
    }
    url.searchParams.append('index', options.index?.toString() ?? '0')
    url.searchParams.append('pageSize', options.pageSize?.toString() ?? '25')
    if (options.slug) {
      url.searchParams.append('slug', options.slug)
    }
    const response = await this.fetch(url, {
      headers: {
        ...this.headers,
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as { data: Mod[]; pagination: Pagination }
    return result
  }

  /**
   * https://docs.curseforge.com/#get-mod-file-changelog
   */
  async getModFileChangelog(modId: number, fileId: number, signal?: AbortSignal) {
    const url = new URL(this.baseUrl + `/v1/mods/${modId}/files/${fileId}/changelog`)
    const response = await this.fetch(url, {
      headers: {
        ...this.headers,
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as { data: string }
    return result.data
  }

  async getFingerprintsMatchesByGameId(
    gameId: number,
    fingerprints: number[],
    signal?: AbortSignal,
  ) {
    const url = new URL(this.baseUrl + `/v1/fingerprints/${gameId}`)
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ fingerprints }),
      headers: {
        ...this.headers,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as FingerprintsMatchesResult
    return result.data
  }

  async getFingerprintsFuzzyMatchesByGameId(
    gameId: number,
    fingerprints: number[],
    signal?: AbortSignal,
  ) {
    const url = new URL(this.baseUrl + `/v1/fingerprints/fuzzy/${gameId}`)
    const response = await this.fetch(url, {
      method: 'POST',
      body: JSON.stringify({ fingerprints }),
      headers: {
        ...this.headers,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      signal,
    })
    if (response.status !== 200) {
      throw new CurseforgeApiError(url.toString(), response.status, await response.text())
    }
    const result = (await response.json()) as FingerprintFuzzyMatchResult
    return result.data
  }
}

export function guessCurseforgeFileUrl(id: number, name: string) {
  const fileId = id.toString()
  return [
    `https://edge.forgecdn.net/files/${fileId.slice(0, 4)}/${fileId.slice(4)}/${name}`,
    `https://mediafiles.forgecdn.net/files/${fileId.slice(0, 4)}/${fileId.slice(4)}/${name}`,
  ]
}
