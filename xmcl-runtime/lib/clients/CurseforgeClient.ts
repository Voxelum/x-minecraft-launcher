import { File, Mod, ModCategory, ModsSearchSortField, Pagination, SearchOptions } from '@xmcl/curseforge'
import { GetModFilesOptions } from '@xmcl/runtime-api'
import { Dispatcher, request } from 'undici'

export class CurseforgeClient {
  constructor(private apiKey: string, private dispatcher?: Dispatcher) {
  }

  async getCategories(signal?: AbortSignal) {
    const response = await request('https://api.curseforge.com/v1/categories', {
      query: { gameId: 432 },
      dispatcher: this.dispatcher,
      headers: {
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      signal,
    })
    const categories: { data: ModCategory[] } = await response.body.json()
    return categories.data
  }

  async getMod(modId: number, signal?: AbortSignal) {
    const response = await request(`https://api.curseforge.com/v1/mods/${modId}`, {
      dispatcher: this.dispatcher,
      headers: {
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      signal,
    })
    const result: { data: Mod } = await response.body.json()
    return result.data
  }

  async getModDescription(modId: number, signal?: AbortSignal) {
    const response = await request(`https://api.curseforge.com/v1/mods/${modId}/description`, {
      dispatcher: this.dispatcher,
      headers: {
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      signal,
    })
    const result: { data: string } = await response.body.json()
    return result.data
  }

  async getModFiles(options: GetModFilesOptions, signal?: AbortSignal) {
    const response = await request(`https://api.curseforge.com/v1/mods/${options.modId}/files`, {
      query: {
        gameVersion: options.gameVersion,
        modLoaderType: options.modLoaderType,
        gameVersionTypeId: options.gameVersionTypeId,
        index: options.index,
        pageSize: options.pageSize,
      },
      dispatcher: this.dispatcher,
      headers: {
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      signal,
    })
    const result: { data: File[]; pagination: Pagination } = await response.body.json()
    return result
  }

  async getModFile(modId: number, fileId: number, signal?: AbortSignal) {
    const response = await request(`https://api.curseforge.com/v1/mods/${modId}/files/${fileId}`, {
      headers: {
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      dispatcher: this.dispatcher,
      signal,
    })
    const result: { data: File } = await response.body.json()
    return result.data
  }

  async getMods(modIds: number[], signal?: AbortSignal) {
    const response = await request('https://api.curseforge.com/v1/mods', {
      method: 'POST',
      body: JSON.stringify({ modIds }),
      dispatcher: this.dispatcher,
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      signal,
    })
    const result: { data: Mod[] } = await response.body.json()
    return result.data
  }

  async getFiles(fileIds: number[], signal?: AbortSignal) {
    const response = await request('https://api.curseforge.com/v1/mods/files', {
      method: 'POST',
      body: JSON.stringify({ fileIds }),
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      dispatcher: this.dispatcher,
      connectTimeout: 20_000,
      headersTimeout: 20_000,
      bodyTimeout: 10_000,
      signal,
    })
    const result: { data: File[] } = await response.body.json()
    return result.data
  }

  async getFileChangelog(modId: number, fileId: number, signal?: AbortSignal) {
    const response = await request(`https://api.curseforge.com/v1/mods/${modId}/files/${fileId}/changelog`, {
      method: 'GET',
      headers: {
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      dispatcher: this.dispatcher,
      connectTimeout: 20_000,
      headersTimeout: 20_000,
      bodyTimeout: 10_000,
      signal,
    })
    const result: { data: string } = await response.body.json()
    return result.data
  }

  async searchMods(options: SearchOptions, signal?: AbortSignal) {
    const query: Record<string, string | number | boolean> = {
      gameId: 432,
    }
    if (options.classId) query.classId = options.classId
    if (options.categoryId) query.categoryId = options.categoryId
    if (options.gameVersion) query.gameVersion = options.gameVersion
    if (options.searchFilter) query.searchFilter = options.searchFilter
    query.sortField = options.sortField ?? ModsSearchSortField.Popularity
    query.sortOrder = options.sortOrder ?? 'desc'
    if (options.modLoaderType) query.modLoaderType = options.modLoaderType
    if (options.gameVersionTypeId) query.gameVersionTypeId = options.gameVersionTypeId
    query.index = options.index ?? '0'
    query.pageSize = options.pageSize ?? '25'
    if (options.slug) query.slug = options.slug
    const response = await request('https://api.curseforge.com/v1/mods/search', {
      query,
      headers: {
        'x-api-key': this.apiKey,
        accept: 'application/json',
      },
      dispatcher: this.dispatcher,
      signal,
    })
    const result: { data: Mod[]; pagination: Pagination } = await response.body.json()
    return result
  }
}
