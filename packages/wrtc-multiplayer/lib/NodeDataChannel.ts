import { NativeModuleLoader } from '@xmcl/utils'
import type { PeerConnectionProvider } from '@xmcl/multiplayer-core/peerConnection'
import { dependencies } from '../package.json'

type NodeDataChannel = typeof import('node-datachannel')
type LoadedNodeDataChannel = Pick<NodeDataChannel, 'PeerConnection' | 'cleanup'>

const version = dependencies['node-datachannel']
const os = process.platform
const arch = process.arch
const url = `https://github.com/murat-dogan/node-datachannel/releases/download/v${version}/node-datachannel-v${version}-napi-v8-${os}-${arch}.tar.gz`

export const NodeDataChannelModule = new NativeModuleLoader<LoadedNodeDataChannel>('node_datachannel.node', () => [url, url], async (_, binding) => {
  if (!binding) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PeerConnection, cleanup } = await import('node-datachannel')
    return { PeerConnection, cleanup }
  }
  return binding as LoadedNodeDataChannel
})

let cleaned = false

export async function cleanupNodeDataChannel() {
  if (cleaned) return
  cleaned = true
  const module = await NodeDataChannelModule.getInstance()
  module.cleanup()
}

export async function createNodeDataChannelPeerConnectionProvider(
  appDataPath: string,
  privatePort = 35_565,
): Promise<PeerConnectionProvider> {
  NodeDataChannelModule.init(appDataPath)
  const [{ PeerConnection }, { RTCPeerConnection }] = await Promise.all([
    NodeDataChannelModule.getInstance(),
    import('node-datachannel/polyfill'),
  ])
  return {
    createPeerConnection(configuration) {
      return new (RTCPeerConnection as any)(
        {
          ...configuration,
          iceTransportPolicy: 'all',
          portRangeBegin: privatePort,
          portRangeEnd: privatePort,
          enableIceUdpMux: true,
        },
        PeerConnection,
      ) as RTCPeerConnection
    },
  }
}
