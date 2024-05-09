import { NativeModuleLoader } from '../util/NativeModule'
import { dependencies } from '../package.json'

type NodeDataChannel = typeof import('node-datachannel')

const version = dependencies['node-datachannel']
const os = process.platform
const arch = process.arch
const url = `https://github.com/murat-dogan/node-datachannel/releases/download/v${version}/node-datachannel-v${version}-napi-v8-${os}-${arch}.tar.gz`

export const NodeDataChannelModule = new NativeModuleLoader('node_datachannel.node', () => [url, url], (_, binding) => {
  if (!binding) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('node-datachannel') as NodeDataChannel
    return mod
  }
  return binding as NodeDataChannel
})
