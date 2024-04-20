import { CachedFTBModpackVersionManifest, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useDomainResources } from './resources'

export interface ModpackItem {
  resource?: Resource
  ftb?: CachedFTBModpackVersionManifest
  type: 'raw' | 'curseforge' | 'modrinth' | 'ftb'
  tags: string[]
  name: string
  version: string
  author: string
  size: number | string
  icon: string | undefined
  id: string
}

export const kModpacks: InjectionKey<ReturnType<typeof useModpacks>> = Symbol('Modpacks')

export function useModpacks() {
  return useDomainResources(ResourceDomain.Modpacks)
}
