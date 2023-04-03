import { FTBModpackManifest, FTBModpackVersionManifest, FTBVersion } from '@xmcl/runtime-api'

export interface FTBModpacksResult {
  packs: number[]
  curseforge: number[]
  total: number
  limit: number
  refreshed: number
}

export interface GetFTBModpackVersionOptions {
  modpack: number | FTBModpackManifest
  version: FTBVersion
}

export interface SearchFTBModpackOptions {
  keyword?: string
}

export class FTBClient {
  constructor(private endpoint: string = 'https://api.modpacks.ch') { }

  async searchModpacks(options?: SearchFTBModpackOptions): Promise<FTBModpacksResult> {
    const response = await fetch(`${this.endpoint}/public/modpack/search/8?term=${options?.keyword ?? ''}`)
    const result: FTBModpacksResult = await response.json()
    return result
  }

  async getFeaturedModpacks(): Promise<FTBModpacksResult> {
    const response = await fetch(`${this.endpoint}/public/modpack/featured/5`)
    const result: FTBModpacksResult = await response.json()
    return result
  }

  async getModpackManifest(id: number): Promise<FTBModpackManifest> {
    const response = await fetch(`${this.endpoint}/public/modpack/${id}`)
    const result: FTBModpackManifest = await response.json()
    return result
  }

  async getModpackVersionManifest({ modpack, version }: GetFTBModpackVersionOptions): Promise<FTBModpackVersionManifest> {
    const modpackId = typeof modpack === 'number' ? modpack : modpack.id
    const response = await fetch(`${this.endpoint}/public/modpack/${modpackId}/${version.id}`)
    const result: FTBModpackVersionManifest = await response.json()
    if ((result as any).status === 'error') {
      throw new Error(`Fail to get manifest for ${modpackId} ${version.id}`)
    }
    return result
  }

  async getModpackVersionChangelog({ modpack, version }: GetFTBModpackVersionOptions): Promise<string> {
    const modpackId = typeof modpack === 'number' ? modpack : modpack.id
    const response = await fetch(`${this.endpoint}/public/modpack/${modpackId}/${version.id}/changelog`)
    const result: { content: string } = await response.json()
    return result.content
  }
}
