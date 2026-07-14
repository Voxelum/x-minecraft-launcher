import { InstanceData, InstanceFile, InstanceUpstream } from '@xmcl/instance'
import { CachedFTBModpackVersionManifest } from '@xmcl/runtime-api'
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
  /**
   * Projects that could not be resolved to a compatible version for the current
   * instance (e.g. from a collection bulk install). Shown as an alert in the
   * install dialog so the user knows what was left out.
   */
  incompatible?: Array<{ id: string; name: string }>
}

export const InstanceInstallDialog: DialogKey<InstanceInstallOptions> = 'instance-install'
export const UnresolvedFilesDialogKey: DialogKey<void> = 'unresolved-files'
export const BaseSettingModUpgradeDialogKey: DialogKey<{ minecraftVersion: string }> = 'base-setting-mod-upgrade'
export const kUpstream: InjectionKey<Ref<{ upstream: InstanceData['upstream']; minecraft: string }>> = Symbol('Upstream')
