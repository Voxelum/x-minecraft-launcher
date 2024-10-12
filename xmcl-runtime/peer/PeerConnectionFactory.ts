export interface PeerConnectionFactory {
  createConnection(ice: RTCIceServer | undefined, privatePort?: number): RTCPeerConnection
}
