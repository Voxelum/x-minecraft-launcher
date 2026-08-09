import type { PeerSession } from './connection'

export interface InitiateOptions {
  /**
   * Peer client id
   */
  remoteId?: string
  /**
   * Peer connection id
   */
  session?: string
  /**
   * Is the peer the initiator (create the offer)
   */
  initiate?: boolean
  /**
   * The using ice server
   */
  targetIceServer?: RTCIceServer
  /**
   * Use the ice server
   */
  preferredIceServers?: RTCIceServer[]
}

/**
 * In-memory registry of active `PeerSession` instances.
 *
 * Lives in its own module so that helper subsystems (LAN discover, peer
 * sharing, peer host, peer group) can take a `Peers` reference without
 * pulling in the full `multiplayerImpl` factory and creating an import
 * cycle.
 */
export class Peers {
  private peers: Record<string, PeerSession> = {}

  onremove: (id: string) => void = () => {}

  add(peer: PeerSession) {
    this.peers[peer.id] = peer
  }

  #validate(sess: PeerSession) {
    if (
      sess &&
      (sess.isClosed ||
        sess.connection.connectionState === 'closed' ||
        sess.connection.connectionState === 'disconnected')
    ) {
      delete this.peers[sess.id]
      this.onremove(sess.id)
      return undefined
    }
    return sess
  }

  get(id: string, remoteId?: string): PeerSession | undefined {
    const sess =
      this.peers[id] || Object.values(this.peers).find((p) => p.remoteId === (remoteId || id))

    return this.#validate(sess)
  }

  remove(id: string) {
    if (!this.peers[id]) return
    delete this.peers[id]
    this.onremove(id)
  }

  get entries() {
    return Object.values(this.peers)
      .map((p) => this.#validate(p))
      .filter((v) => !!v) as PeerSession[]
  }
}
