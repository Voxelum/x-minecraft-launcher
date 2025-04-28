export interface PeerConnectionFactory {
  createConnection(ice: RTCIceServer[], privatePort?: number): RTCPeerConnection
}
