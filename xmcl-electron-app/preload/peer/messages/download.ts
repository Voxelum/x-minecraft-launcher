import { InstanceManifestSchema } from '@xmcl/runtime-api'
import { ipcRenderer } from 'electron'
import { defineMessage, MessageType } from './message'

export const MessageShareManifest: MessageType<{ manifest: InstanceManifestSchema }> = 'instance-manifest'
export const MessageGetSharedManifest: MessageType<void> = 'get-instance-manifest'

export const MessageShareManifestEntry = defineMessage(MessageShareManifest, function (msg) {
  ipcRenderer.send('shared-instance-manifest', { id: this.id, manifest: msg })
})

export const MessageGetSharedManifestEntry = defineMessage(MessageGetSharedManifest, function (msg) {
  this.send(MessageShareManifest, { manifest: this.host.getSharedInstance() })
})
