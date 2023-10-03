import { FTBAuthor, FTBModpackVersionManifest } from './ftb'
/* eslint-disable no-redeclare */
import _FTBVersionManifestStoreSchema from './FTBVersionManifestStoreSchema.json'

export interface CachedFTBModpackVersionManifest extends FTBModpackVersionManifest {
  iconUrl: string
  projectName: string
  authors: FTBAuthor[]
}
