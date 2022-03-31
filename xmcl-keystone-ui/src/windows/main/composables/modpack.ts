import { PersistedCurseforgeModpackResource, PersistedMcbbsModpackResource, PersistedModpackResource } from '@xmcl/runtime-api'

export type ModpackResources = PersistedModpackResource | PersistedCurseforgeModpackResource | PersistedMcbbsModpackResource

export interface ModpackItem {
  resource: ModpackResources
  type: 'raw' | 'curseforge' | 'modrinth'
  tags: string[]
  name: string
  version: string
  author: string
  size: number
  icon: string | undefined
  id: string
}
