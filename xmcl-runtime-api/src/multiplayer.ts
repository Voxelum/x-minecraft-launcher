import type { LanServerInfo } from '@xmcl/client'
import { InstanceManifest } from './entities/instanceManifest.schema'
import { GameProfileAndTexture } from './entities/user.schema'
import { GenericEventEmitter } from './events'

export interface RTCSessionDescription {
  sdp: string
  type: 'answer' | 'offer' | 'pranswer' | 'rollback'
}

export type ConnectionState =
  | 'closed'
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | 'failed'
  | 'new'
export type IceGatheringState = 'complete' | 'gathering' | 'new'
export type SignalingState =
  | 'closed'
  | 'have-local-offer'
  | 'have-local-pranswer'
  | 'have-remote-offer'
  | 'have-remote-pranswer'
  | 'stable'

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
  'local-lan': LanServerInfo
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

export interface MultiplayerRoomAdmission {
  roomId: string
  roomSessionId?: string
  socketUrl: string
  ticket: string
  peerId: string
  expiresAt: string
  role: 'master' | 'member'
  maxPeers: number
}

export interface MultiplayerRoomMember {
  peerId: string
  accountId: string
  displayName: string
  status: 'negotiating' | 'connected'
  joinedAt: number
}

export interface MultiplayerRoomState {
  selfPeerId: string
  masterPeerId: string
  members: MultiplayerRoomMember[]
  status: 'open' | 'waiting-master' | 'closed'
  maxPeers: number
  revision: number
}

export interface MultiplayerIceServerCredential {
  turnSessionId?: string
  uris?: string[]
  ttl?: number
  password?: string
  username?: string
  stuns: string[]
  meta?: Record<string, string>
  servers?: Array<{
    urls: string | string[]
    username?: string
    credential?: string
  }>
}

export type MultiplayerTransport = 'webrtc' | 'node-datachannel'

export type MultiplayerTelemetryStage =
  | 'signaling_socket'
  | 'peer_created'
  | 'remote_description'
  | 'ice_gathering'
  | 'ice_connection'
  | 'metadata_channel'
  | 'minecraft_bridge'

export type MultiplayerTelemetryAttemptKind =
  | 'signaling_socket'
  | 'peer_connection'
  | 'minecraft_bridge'

export type MultiplayerTelemetryOutcome =
  | 'started'
  | 'succeeded'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'closed'

export type MultiplayerTelemetryFailureCode =
  | 'signaling_open_failed'
  | 'signaling_closed'
  | 'signaling_state_invalid'
  | 'remote_description_invalid'
  | 'ice_gathering_failed'
  | 'ice_connection_failed'
  | 'ice_timeout'
  | 'data_channel_failed'
  | 'metadata_timeout'
  | 'bridge_bind_failed'
  | 'bridge_connect_failed'
  | 'peer_closed'
  | 'launcher_shutdown'
  | 'unknown'

export interface MultiplayerTelemetryEvent {
  attemptId: string
  roomSessionId?: string
  turnSessionId?: string
  kind: MultiplayerTelemetryAttemptKind
  mode: 'official_room' | 'manual_offer'
  role: 'master' | 'member'
  outcome: Exclude<MultiplayerTelemetryOutcome, 'started'>
  failedStage?: MultiplayerTelemetryStage
  failureCode?: MultiplayerTelemetryFailureCode
  route?: 'unknown' | 'direct' | 'relay'
  localCandidateType?: SelectedCandidateInfo['type']
  remoteCandidateType?: SelectedCandidateInfo['type']
  networkProtocol?: SelectedCandidateInfo['transportType']
  retry: number
  durationMs?: number
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

  refreshIceServers(): Promise<void>
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
  /** Create a new multiplayer room as its master. */
  createGroup(): Promise<void>
  /** Join an existing multiplayer room as a member. */
  joinGroup(groupId: string): Promise<void>
  /**
   * Transfer the room master role to another connected member.
   */
  transferGroupMaster(peerId: string): Promise<void>
  /**
   * Leave the group
   */
  leaveGroup(): Promise<void>
}
