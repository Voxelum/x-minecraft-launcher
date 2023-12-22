import { InstanceManifest } from '../entities/instanceManifest.schema'
import { GameProfileAndTexture } from '../entities/user.schema'
import { GenericEventEmitter } from '../events'
import { MutableState } from '../util/MutableState'
import { ServiceKey } from './Service'

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
export interface PeerConnection {
  id: string
  remoteId: string
  userInfo: ConnectionUserInfo
  initiator: boolean
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

export class PeerState {
  connections = [] as PeerConnection[]

  connectionUserInfo({ id, info }: { id: string; info: ConnectionUserInfo }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.userInfo = info
    }
  }

  connectionShareManifest({ id, manifest }: { id: string; manifest?: InstanceManifest }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.sharing = manifest
    }
  }

  connectionRemoteSet({ id, remoteId }: { id: string; remoteId: string }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.remoteId = remoteId
    }
  }

  connectionAdd(connection: PeerConnection) {
    if (this.connections.find(c => c.id === connection.id)) {
      return
    }
    this.connections.push(connection)
  }

  connectionDrop(connectionId: string) {
    this.connections = this.connections.filter(c => c.id !== connectionId)
  }

  connectionLocalDescription(update: { id: string; description: string }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.localDescriptionSDP = update.description
    }
  }

  connectionStateChange(update: { id: string; connectionState: ConnectionState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.connectionState = update.connectionState
    }
  }

  connectionSelectedCandidate({ id, local, remote }: {
    id: string
    local: SelectedCandidateInfo
    remote: SelectedCandidateInfo
  }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.selectedCandidate = {
        local,
        remote,
      }
    }
  }

  connectionPing(update: { id: string; ping: number }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.ping = update.ping
    }
  }

  iceGatheringStateChange(update: { id: string; iceGatheringState: IceGatheringState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.iceGatheringState = update.iceGatheringState
    }
  }

  signalingStateChange(update: { id: string; signalingState: SignalingState }) {
    const conn = this.connections.find(c => c.id === update.id)
    if (conn) {
      conn.signalingState = update.signalingState
    }
  }
}

export interface ShareInstanceOptions {
  instancePath: string
  manifest?: InstanceManifest
}

interface PeerServiceEvents {
  share: { id: string; manifest?: InstanceManifest }
  'connection-local-description': { description: TransferDescription; type: 'offer' | 'answer' }
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
  gameProfile?: GameProfileAndTexture
}

export interface InitiateOptions {
  /**
   * Peer id
   */
  remoteId?: string
  /**
   * Peer connection id
   */
  session?: string
  initiate?: boolean
  gameProfile?: GameProfileAndTexture
}

export interface PeerService extends GenericEventEmitter<PeerServiceEvents> {
  getPeerState(): Promise<MutableState<PeerState>>
  /**
    * Share the instance to other peers
    */
  shareInstance(options: ShareInstanceOptions): Promise<void>
  /**
   * Initiate a peer connection, and return the session description payload.
   * You need to manually send this offer payload to other user
   */
  initiate(options: InitiateOptions): Promise<string>
  /**
   * Receive the offer/answer from other user.
   */
  setRemoteDescription(options: SetRemoteDescriptionOptions): Promise<string>
  /**
   * Low level api to create peer
   *
   * Drop the existed session
   * @param id The session to drop
   */
  drop(id: string): Promise<void>
}

export const PeerServiceKey: ServiceKey<PeerService> = 'PeerServiceKey'
