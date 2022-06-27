export type ProjectType = 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks'

export interface CurseforgeProjectHeader {
  id: string
  logoUrl: string
  type: ProjectType
  summary: string
  websiteUrl: string
}
