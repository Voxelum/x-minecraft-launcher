import { FTBAuthor, FTBModpackVersionManifest } from './ftb'

export interface CachedFTBModpackVersionManifest extends FTBModpackVersionManifest {
  iconUrl: string
  projectName: string
  authors: FTBAuthor[]
}
