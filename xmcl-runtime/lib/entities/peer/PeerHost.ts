import { MinecraftLanBroadcaster } from '@xmcl/client'
import { ConnectionUserInfo, InstanceManifestSchema } from '@xmcl/runtime-api'
import { Readable } from 'stream'
export interface PeerHost {
  getUserInfo(): ConnectionUserInfo
  createSharedFileReadStream(file: string): Readable | undefined
  getSharedInstance(): InstanceManifestSchema | undefined

  onIdentity(id: string, info: ConnectionUserInfo): void
  onInstanceShared(id: string, manifest: InstanceManifestSchema): void
  onHeartbeat(id: string, ping: number): void

  broadcaster: MinecraftLanBroadcaster
}
