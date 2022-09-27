import { CachedFTBModpackVersionManifest } from '../entities/ftb.schema'
import { FTBModpackManifest, FTBModpackVersionManifest, FTBVersion } from '../entities/ftb'
import { ServiceKey, StatefulService } from './Service'

export class FeedTheBeastState {
  downloading = [] as { url: string; taskId: string }[]

  ftbDownloadFileStart({ url, taskId }: { url: string; taskId: string }) {
    this.downloading.push({ url, taskId })
  }

  ftbDownloadFileEnd(url: string) {
    this.downloading = this.downloading.filter((f) => f.url !== url)
  }
}

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

export interface FeedTheBeastService extends StatefulService<FeedTheBeastState> {
  getAllCachedModpackVersions(): Promise<CachedFTBModpackVersionManifest[]>

  searchModpacks(options?: SearchFTBModpackOptions): Promise<FTBModpacksResult>

  getFeaturedModpacks(): Promise<FTBModpacksResult>

  getModpackManifest(id: number): Promise<FTBModpackManifest>

  getModpackVersionManifest(options: GetFTBModpackVersionOptions): Promise<FTBModpackVersionManifest>

  getModpackVersionChangelog(options: GetFTBModpackVersionOptions): Promise<string>

  removeModpackCache(id: number): Promise<void>
}

export const FeedTheBeastServiceKey: ServiceKey<FeedTheBeastService> = 'FeedTheBeastService'
