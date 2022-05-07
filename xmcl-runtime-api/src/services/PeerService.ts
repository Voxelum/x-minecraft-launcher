import { InstanceManifestSchema } from 'src/entities/instanceManifest.schema'
import { ServiceKey, StatefulService } from './Service'

export interface RTCSessionDescription {
  sdp?: string
  type: 'answer' | 'offer' | 'pranswer' | 'rollback'
}

type ConnectionState = 'closed' | 'connected' | 'connecting' | 'disconnected' | 'failed' | 'new'
type IceGatheringState = 'complete' | 'gathering' | 'new'
type SignalingState = 'closed' | 'have-local-offer' | 'have-local-pranswer' | 'have-remote-offer' | 'have-remote-pranswer' | 'stable'

export interface ConnectionUserInfo {
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
  userInfo: ConnectionUserInfo
  initiator: boolean
  localDescriptionSDP: string
  connectionState: ConnectionState
  iceGatheringState: IceGatheringState
  signalingState: SignalingState
  /**
   * The instance that this peer is sharing
   */
  sharing?: InstanceManifestSchema
}

export class PeerState {
  connections = [] as PeerConnection[]

  connectionUserInfo({ id, info }: { id: string; info: ConnectionUserInfo }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.userInfo = info
    }
  }

  connectionShareManifest({ id, manifest } : { id: string; manifest?: InstanceManifestSchema }) {
    const conn = this.connections.find(c => c.id === id)
    if (conn) {
      conn.sharing = manifest
    }
  }

  connectionAdd(connection: PeerConnection) {
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
  manifest?: InstanceManifestSchema
}

export interface PeerService extends StatefulService<PeerState> {
  /**
   * Create a new unconnected ready-to-go peer connection.
   *
   * @returns The id of the connection.
   */
  create(): Promise<string>
  /**
   * Initiate a peer connection, and return the session description payload.
   * You need to manually send this offer payload to other user
   *
   * @param id The id of the peer connection. You need to call `create` to get the new one.
   */
  initiate(id: string): Promise<void>
  /**
   * Receive the offer from other user, and create peer corresponding to it.
   *
   * @param offer The compressed `offer` sdp string from other user
   * @returns The id of the connection session
   */
  offer(offer: string): Promise<string>
  /**
   * Receive the answer from other user. This will finally create the connection between you and other
   *
   * @param answer The compressed `answer` sdp string from other user
   */
  answer(answer: string): Promise<void>
  /**
   * Low level api to create peer
   *
   * Drop the existed session
   * @param id The session to drop
   */
  drop(id: string): Promise<void>
  /**
   * Share the instance to other peers
   */
  shareInstance(options: ShareInstanceOptions): Promise<void>
}

export const PeerServiceKey: ServiceKey<PeerService> = 'PeerServiceKey'
