import { NodeDataChannelModule } from './NodeDataChannel'

export interface PeerConnectionFactory {
  init(appDataPath: string): Promise<void>
  createConnection(ice: RTCIceServer[], privatePort?: number): RTCPeerConnection
}

export function createPeerConnectionFactory() {
  let _PeerConnection: any
  let _RTCPeerConnection: typeof RTCPeerConnection

  NodeDataChannelModule.getInstance().then(({ PeerConnection }) => {
    _PeerConnection = PeerConnection
  })
  import('node-datachannel/polyfill').then(({ RTCPeerConnection }) => {
    _RTCPeerConnection = RTCPeerConnection as any
  })
  const factory: PeerConnectionFactory = {
    async init(appDataPath: string) {
      return NodeDataChannelModule.init(appDataPath)
    },
    createConnection: (servers, privatePort) => {
      if (localStorage.getItem('peerKernel') === 'webrtc') {
        console.log('Use webrtc', servers)
        return new RTCPeerConnection({
          iceServers: servers,
          iceCandidatePoolSize: 4,
        })
      }
      console.log('Use node data channel', servers)
      try {
        if (_RTCPeerConnection && _PeerConnection) {
          return new _RTCPeerConnection({
            iceServers: servers,
            iceTransportPolicy: 'all',
            iceCandidatePoolSize: 4,
            enableIceUdpMux: true,
            // @ts-ignore
          }, _PeerConnection)
        } else {
          return new RTCPeerConnection({
            iceServers: servers,
            iceCandidatePoolSize: 4,
          })
        }
      } catch (e) {
        console.debug(e)
        console.log('Use webrtc fallback', servers)
        return new RTCPeerConnection({
          iceServers: servers,
          iceCandidatePoolSize: 4,
        })
      }
    },
  }
  return factory
}