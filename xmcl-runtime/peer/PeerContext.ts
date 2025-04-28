import { LanServerInfo } from '@xmcl/client'
import { ConnectionUserInfo, InstanceManifest } from '@xmcl/runtime-api'
import { PeerSession } from './PeerSession'

export interface RTCPeerConnectionData {
  id: string
  sdp: string
  type: 'offer' | 'answer' | string
  turnserver?: RTCIceServer
  candidates: Array<{ candidate: string; mid: string }>
}

export interface PeerContext {
  isMaster(): boolean
  getUserInfo(): ConnectionUserInfo
  getSharedInstance(): InstanceManifest | undefined
  getShadedInstancePath(): string
  getSharedImagePath(image: string): string
  getSharedLibrariesPath(): string
  getSharedAssetsPath(): string

  onIdentity(session: string, info: ConnectionUserInfo): void
  onInstanceShared(session: string, manifest?: InstanceManifest): void
  onDescriptorUpdate(session: string, connections: RTCPeerConnectionData[]): void
  onHeartbeat(session: string, ping: number): void
  onLanMessage(session: string, inf: LanServerInfo): void
  onConnectionEstablished(session: string, connection: RTCPeerConnection): void

  getIceServerCandidates(): RTCIceServer[][]
  createConnection(ices: RTCIceServer[], privatePort?: number): RTCPeerConnection
  getPeer(peerId: string): PeerSession | undefined
}
