import { MinecraftLanBroadcaster } from '@xmcl/client'
import { ConnectionUserInfo, InstanceManifestSchema } from '@xmcl/runtime-api'
import { DescriptionType } from 'node-datachannel'
import { Readable } from 'stream'
export interface PeerHost {
  getUserInfo(): ConnectionUserInfo
  createSharedFileReadStream(file: string): Readable | undefined
  getSharedInstance(): InstanceManifestSchema | undefined

  onIdentity(id: string, info: ConnectionUserInfo): void
  onInstanceShared(id: string, manifest: InstanceManifestSchema): void
  onDescriptorUpdate(sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>): void
  onHeartbeat(id: string, ping: number): void

  broadcaster: MinecraftLanBroadcaster
}
