import { PeerSession } from './PeerSession';

export class Peers {
  private peers: Record<string, PeerSession> = {};

  constructor(public onremove: (id: string) => void = () => { }) { }

  add(peer: PeerSession) {
    this.peers[peer.id] = peer;
  }

  get(id: string, remoteId?: string): PeerSession | undefined {
    const sess = this.peers[id] || Object.values(this.peers).find(p => p.peerId === (remoteId || id));

    return sess;
  }

  remove(id: string) {
    delete this.peers[id];
    this.onremove(id);
  }

  get entries() {
    return Object.values(this.peers);
  }
}
