import { FTBModpackManifest, FTBModpacksResult, FTBModpackVersionManifest, GetFTBModpackVersionOptions, SearchFTBModpackOptions } from '@xmcl/runtime-api'
import { Dispatcher, request } from 'undici'

export class FeedTheBeastClient {
  constructor(private dispatcher?: Dispatcher) {
  }

  async searchModpacks(options?: SearchFTBModpackOptions): Promise<FTBModpacksResult> {
    const response = await request(`https://api.modpacks.ch/public/modpack/search/8?term=${options?.keyword ?? ''}`, { dispatcher: this.dispatcher })
    const result: FTBModpacksResult = await response.body.json()
    return result
  }

  async getFeaturedModpacks(): Promise<FTBModpacksResult> {
    const response = await request('https://api.modpacks.ch/public/modpack/featured/5', { dispatcher: this.dispatcher })
    const result: FTBModpacksResult = await response.body.json()
    return result
  }

  async getModpackManifest(id: number): Promise<FTBModpackManifest> {
    const response = await request(`https://api.modpacks.ch/public/modpack/${id}`, { dispatcher: this.dispatcher })
    const result: FTBModpackManifest = await response.body.json()
    return result
  }

  async getModpackVersionManifest({ modpack, version }: GetFTBModpackVersionOptions): Promise<FTBModpackVersionManifest> {
    const modpackId = typeof modpack === 'number' ? modpack : modpack.id
    const response = await request(`https://api.modpacks.ch/public/modpack/${modpackId}/${version.id}`, { dispatcher: this.dispatcher })
    const result: FTBModpackVersionManifest = await response.body.json()
    if ((result as any).status === 'error') {
      throw new Error(`Fail to get manifest for ${modpackId} ${version.id}`)
    }
    return result
  }

  async getModpackVersionChangelog({ modpack, version }: GetFTBModpackVersionOptions): Promise<string> {
    const modpackId = typeof modpack === 'number' ? modpack : modpack.id
    const response = await request(`https://api.modpacks.ch/public/modpack/${modpackId}/${version.id}/changelog`, { dispatcher: this.dispatcher })
    const result: { content: string } = await response.body.json()
    return result.content
  }
}
