import { InstanceManifestSchema } from '@xmcl/runtime-api'
// import { ipcRenderer } from 'electron'
import { defineMessage, MessageType } from './message'

export const MessageShareManifest: MessageType<{ manifest: InstanceManifestSchema }> = 'instance-manifest'
export const MessageGetSharedManifest: MessageType<void> = 'get-instance-manifest'

export const MessageShareManifestEntry = defineMessage(MessageShareManifest, function (msg) {
  const manifest = msg.manifest
  if (manifest) {
    for (const file of manifest.files) {
      if (file.downloads) {
        file.downloads.push(`peer://${this.id}/${file.path}`)
      } else {
        file.downloads = [`peer://${this.id}/${file.path}`]
      }
    }
  }
  this.host.onInstanceShared(this.id, msg.manifest)
})

export const MessageGetSharedManifestEntry = defineMessage(MessageGetSharedManifest, function (msg) {
  this.send(MessageShareManifest, { manifest: this.host.getSharedInstance() })
})
