import type { File } from '@xmcl/curseforge'
export type ProjectType = 'mc-mods' | 'texture-packs' | 'worlds' | 'modpacks'

export interface CurseforgeProjectHeader {
  id: string
  logoUrl: string
  type: ProjectType
  summary: string
  websiteUrl: string
}

export const getCurseforgeFileUrl = (f: File) => f.downloadUrl ?? (`curseforge:${f.modId}:${f.id}`)
export const getCurseforgeFileUri = (f: Pick<File, 'modId' | 'id'>) => `curseforge:${f.modId}:${f.id}`
