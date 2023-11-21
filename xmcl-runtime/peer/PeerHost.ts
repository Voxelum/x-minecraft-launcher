import { LanServerInfo } from '@xmcl/client'
import { ConnectionUserInfo, InstanceManifest } from '@xmcl/runtime-api'
import { DescriptionType } from 'node-datachannel'
export interface PeerHost {
  getUserInfo(): ConnectionUserInfo
  getSharedInstance(): InstanceManifest | undefined
  getShadedInstancePath(): string
  getSharedImagePath(image: string): string
  getSharedLibrariesPath(): string
  getSharedAssetsPath(): string

  onIdentity(id: string, info: ConnectionUserInfo): void
  onInstanceShared(id: string, manifest: InstanceManifest): void
  onDescriptorUpdate(id: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>): void
  onHeartbeat(id: string, ping: number): void
  onLanMessage(id: string, inf: LanServerInfo): void
}
