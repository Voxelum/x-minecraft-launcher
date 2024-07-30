import { CachedFTBModpackVersionManifest, InstanceData, InstanceFileUpdate, Resource, ResourceMetadata } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { DialogKey } from './dialog'

export type InstanceInstallOptions = {
  type: 'modrinth' | 'curseforge'
  currentResource?: { metadata: Pick<ResourceMetadata, 'instance'> } | Resource
  resource: Resource
} | {
  type: 'ftb'
  newManifest: CachedFTBModpackVersionManifest
  oldManifest: CachedFTBModpackVersionManifest
} | {
  type: 'updates'
  updates: InstanceFileUpdate[]
  id: string
  selectOnlyAdd?: boolean
}

export const InstanceInstallDialog: DialogKey<InstanceInstallOptions> = 'instance-install'
export const kUpstream: InjectionKey<Ref<{ upstream: InstanceData['upstream']; minecraft: string }>> = Symbol('Upstream')
