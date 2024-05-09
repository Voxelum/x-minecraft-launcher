import { InstanceManifest, ShareInstanceOptions } from '@xmcl/runtime-api'
import { join } from 'path'
import { MessageShareManifest } from './messages/download'
import { Peers } from './multiplayerImpl'

export function createPeerSharing(peers: Peers) {
  let sharedManifest: InstanceManifest | undefined
  let shareInstancePath = ''
  let resourcePath = ''

  return {
    setResourcePath: (path: string) => {
      resourcePath = path
    },

    getSharedInstance: () => sharedManifest,
    getShadedInstancePath: () => shareInstancePath,
    getSharedAssetsPath: () => join(resourcePath, 'assets'),
    getSharedLibrariesPath: () => join(resourcePath, 'assets'),
    getSharedImagePath: (image: string) => join(resourcePath, 'images', image),

    shareInstance: async (options: ShareInstanceOptions) => {
      sharedManifest = options.manifest
      shareInstancePath = options.instancePath
      for (const sess of peers.entries) {
        sess.send(MessageShareManifest, { manifest: options.manifest })
      }
    },
  }
}
