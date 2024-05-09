export interface PeerConnectionFactory {
  createConnection(ice: RTCIceServer | undefined, privatePort?: number, turn?: RTCIceServer): Promise<RTCPeerConnection>
}
