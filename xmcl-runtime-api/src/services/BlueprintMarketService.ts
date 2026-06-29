import { ServiceKey } from './Service'

export type BlueprintMarketProvider = 'mcschematic' | 'cms'

export interface BlueprintMarketSearchOptions {
  provider: BlueprintMarketProvider
  keyword?: string
  /**
   * 0-based page index.
   */
  page?: number
  /**
   * `mcschematic`: `time` | `heat`. `cms`: `time` | `download` | `speed`.
   */
  sort?: string
}

export interface BlueprintMarketItem {
  id: string
  provider: BlueprintMarketProvider
  title: string
  author?: string
  description?: string
  /**
   * Preview image url.
   */
  icon?: string
  /**
   * A human-readable size string, e.g. `10×8×12`.
   */
  size?: string
  downloadCount?: number
  /**
   * The blueprint file extension, e.g. `litematic`, `schem`, `nbt`, `json`.
   */
  fileType?: string
  /**
   * The website detail page url.
   */
  pageUrl?: string
  /**
   * Whether this item can be installed directly (CMS is browse-only).
   */
  installable: boolean
}

export interface BlueprintMarketSearchResult {
  items: BlueprintMarketItem[]
  page: number
  hasMore: boolean
}

export interface BlueprintMarketInstallOptions {
  instancePath: string
  item: BlueprintMarketItem
}

/**
 * Search and install blueprints from external blueprint-sharing sites
 * (mcschematic.top and creativemechanicserver.com), mirroring McSTools.
 */
export interface BlueprintMarketService {
  search(options: BlueprintMarketSearchOptions): Promise<BlueprintMarketSearchResult>
  /**
   * Download and install a market blueprint into the instance's `schematics`
   * folder. Returns the written file path.
   */
  install(options: BlueprintMarketInstallOptions): Promise<string>
}

export const BlueprintMarketServiceKey: ServiceKey<BlueprintMarketService> = 'BlueprintMarketService'
