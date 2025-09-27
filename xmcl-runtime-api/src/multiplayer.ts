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
  /**
   * Session id
   */
  id: string
  /**
   * The peer id
   */
  remoteId: string
  userInfo: ConnectionUserInfo
  connectionState: ConnectionState
  localDescriptionSDP: string

  pendingConnections: Array<{
    
  }>

  selectedCandidate?: {
    local: SelectedCandidateInfo
    remote: SelectedCandidateInfo
  }

  ping: number
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

export interface SetRemoteDescriptionOptions {
  type: 'offer' | 'answer'
  /**
   * The remote description
   */
  description: string
}

export interface Multiplayer extends GenericEventEmitter<MultiplayerEvents> {
  /**
   * Is the multiplayer module ready
   */
  isReady(): boolean
  /**
   * Get a peer by id
   */
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
  drop(id: string): void
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
  leaveGroup(): void
}
