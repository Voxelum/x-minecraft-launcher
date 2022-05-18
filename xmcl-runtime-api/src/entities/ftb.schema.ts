import { FTBAuthor, FTBModpackVersionManifest } from './ftb'
/* eslint-disable no-redeclare */
import _FTBVersionManifestStoreSchema from './FTBVersionManifestStoreSchema.json'
import { Schema } from './schema'

export interface FTBVersionManifestStoreSchema {
  caches: CachedFTBModpackVersionManifest[]
}

export interface CachedFTBModpackVersionManifest extends FTBModpackVersionManifest {
  iconUrl: string
  projectName: string
  authors: FTBAuthor[]
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const FTBVersionManifestStoreSchema: Schema<FTBVersionManifestStoreSchema> = _FTBVersionManifestStoreSchema
