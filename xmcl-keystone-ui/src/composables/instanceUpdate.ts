import { CachedFTBModpackVersionManifest, InstanceData, InstanceFile, InstanceFileUpdate, InstanceUpstream } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { DialogKey } from './dialog'

export type InstanceInstallOptions = {
  type: 'upstream'
  instancePath: string
  modpack: string
  upstream: InstanceUpstream
} | {
  type: 'ftb'
  newManifest: CachedFTBModpackVersionManifest
  oldManifest: CachedFTBModpackVersionManifest
  upstream: InstanceUpstream
} | {
  type: 'updates'
  oldFiles: InstanceFile[]
  files: InstanceFile[]
  id: string
}

export const InstanceInstallDialog: DialogKey<InstanceInstallOptions> = 'instance-install'
export const kUpstream: InjectionKey<Ref<{ upstream: InstanceData['upstream']; minecraft: string }>> = Symbol('Upstream')
