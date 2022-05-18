import { CachedFTBModpackVersionManifest, PersistedCurseforgeModpackResource, PersistedMcbbsModpackResource, PersistedModpackResource } from '@xmcl/runtime-api'

export type ModpackResources = PersistedModpackResource | PersistedCurseforgeModpackResource | PersistedMcbbsModpackResource

export interface ModpackItem {
  resource?: ModpackResources
  ftb?: CachedFTBModpackVersionManifest
  type: 'raw' | 'curseforge' | 'modrinth' | 'ftb'
  tags: string[]
  name: string
  version: string
  author: string
  size: number
  icon: string | undefined
  id: string
}
