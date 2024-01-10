import { LanServerInfo } from '@xmcl/client'
import { ConnectionUserInfo, InstanceManifest } from '@xmcl/runtime-api'
import type { DescriptionType } from 'node-datachannel'
export interface PeerHost {
  getUserInfo(): ConnectionUserInfo
  getSharedInstance(): InstanceManifest | undefined
  getShadedInstancePath(): string
  getSharedImagePath(image: string): string
  getSharedLibrariesPath(): string
  getSharedAssetsPath(): string

  onIdentity(session: string, info: ConnectionUserInfo): void
  onInstanceShared(session: string, manifest: InstanceManifest): void
  onDescriptorUpdate(session: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>): void
  onHeartbeat(session: string, ping: number): void
  onLanMessage(session: string, inf: LanServerInfo): void
}
