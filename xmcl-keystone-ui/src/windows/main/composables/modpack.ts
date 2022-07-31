import { CachedFTBModpackVersionManifest, ModpackResource } from '@xmcl/runtime-api'

export interface ModpackItem {
  resource?: ModpackResource
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
