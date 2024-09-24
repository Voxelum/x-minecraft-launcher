import { CachedFTBModpackVersionManifest, ModpackServiceKey, Resource, ResourceDomain, ResourceState } from '@xmcl/runtime-api'
import { InjectionKey } from 'vue'
import { useState } from './syncableState'
import { useService } from './service'

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

export function useModpacks() {
  const { watchModpackFolder } = useService(ModpackServiceKey)
  return useState(watchModpackFolder, ResourceState)
}
