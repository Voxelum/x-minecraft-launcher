import { InstanceManifest } from '@xmcl/runtime-api'
import { defineMessage, MessageType } from './message'

export const MessageShareManifest: MessageType<{ manifest: InstanceManifest }> = 'instance-manifest'
export const MessageGetSharedManifest: MessageType<void> = 'get-instance-manifest'

export const MessageShareManifestEntry = defineMessage(MessageShareManifest, function (msg) {
  const manifest = msg.manifest
  if (manifest) {
    for (const file of manifest.files) {
      if (file.downloads) {
        file.downloads.push(`peer://${this.id}/sharing/${file.path}`)
      } else {
        file.downloads = [`peer://${this.id}/sharing/${file.path}`]
      }
    }
  }
  this.context.onInstanceShared(this.id, msg.manifest)
})

export const MessageGetSharedManifestEntry = defineMessage(MessageGetSharedManifest, function (msg) {
  this.send(MessageShareManifest, { manifest: this.context.getSharedInstance() })
})
