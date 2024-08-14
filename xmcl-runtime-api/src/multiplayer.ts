import type { LanServerInfo } from '@xmcl/client'
import { InstanceManifest } from './entities/instanceManifest.schema'
import { GameProfileAndTexture } from './entities/user.schema'
import { GenericEventEmitter } from './events'

export interface RTCSessionDescription {
  sdp: string
  type: 'answer' | 'offer' | 'pranswer' | 'rollback'
}

export type ConnectionState = 'closed' | 'connected' | 'connecting' | 'disconnected' | 'failed' | 'new'
export type IceGatheringState = 'complete' | 'gathering' | 'new'
export type SignalingState = 'closed' | 'have-local-offer' | 'have-local-pranswer' | 'have-remote-offer' | 'have-remote-pranswer' | 'stable'

export interface SelectedCandidateInfo {
  address: string
  port: number
  type: 'host' | 'prflx' | 'srflx' | 'relay'
  transportType: 'udp' | 'tcp'
}

export interface ConnectionUserInfo extends GameProfileAndTexture {
  /**
   * The readable text
   */
  name: string
  /**
   * The avatar url
   */
  avatar: string
}

/**
 * Represent a peer.
 *
 * A peer might have multiple connections.
 */
export interface Peer {
  id: string
  remoteId: string
  userInfo: ConnectionUserInfo
  initiator: boolean
  /**
   * Current ice server
   */
  iceServer: RTCIceServer
  /**
   * The tried ice servers
   */
  triedIceServers: RTCIceServer[]
  /**
   * The ice servers that this peer prefers
   */
  preferredIceServers: RTCIceServer[]

  selectedCandidate?: {
    local: SelectedCandidateInfo
    remote: SelectedCandidateInfo
  }

  localDescriptionSDP: string
  ping: number
  connectionState: ConnectionState
  iceGatheringState: IceGatheringState
  signalingState: SignalingState
  /**
   * The instance that this peer is sharing
   */
  sharing?: InstanceManifest
}

interface MultiplayerEvents {
  share: { id: string; manifest?: InstanceManifest }
  'connection-unexpected-closed': { id: string }
  lan: LanServerInfo & { session: string }
}

export interface TransferDescription {
  /**
   * The peer id
   */
  id: string
  session: string
  sdp: string
  candidates: Array<{ candidate: string; mid: string }>
}

export interface SetRemoteDescriptionOptions {
  type: 'offer' | 'answer'
  /**
   * The remote description
   */
  description: string | TransferDescription
}

export interface Multiplayer extends GenericEventEmitter<MultiplayerEvents> {
  /**
   * Is the multiplayer module ready
   */
  isReady(): boolean
  /**
   * Get the peers
   */
  getPeers(): Peer[]

  refreshNat(): Promise<void>
  /**
   * Set your user info
   */
  setUserInfo(info: ConnectionUserInfo): void
  /**
   * Initiate a peer connection, and return the session description payload.
   * You need to manually send this offer payload to other user
   */
  initiate(): Promise<string>
  /**
   * Receive the offer/answer from other user.
   */
  setRemoteDescription(options: SetRemoteDescriptionOptions): Promise<string>
  /**
   * Disconnect to the peer
   *
   * Drop the existed session
   * @param id The session to drop
   */
  drop(id: string): Promise<void>
  /**
   * Join the group.
   * The group will automatically create connection between group members.
   *
   * @param groupId The group id
   */
  joinGroup(groupId: string): Promise<void>
  /**
   * Leave the group
   */
  leaveGroup(): Promise<void>
}
