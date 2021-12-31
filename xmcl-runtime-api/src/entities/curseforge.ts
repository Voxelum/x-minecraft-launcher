import { ModpackManifest } from './modpack'

export type ProjectType = 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks'

/**
 * The modpack metadata structure
 */
export interface CurseforgeModpackManifest extends ModpackManifest {
  minecraft: {
    version: string
    libraries?: string
    modLoaders: {
      id: string
      primary: boolean
    }[]
  }
  files: {
    projectID: number
    fileID: number
    required: boolean
  }[]
  overrides: string
}
