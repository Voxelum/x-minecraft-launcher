import { InstanceManifest } from '@xmcl/runtime-api'
import { ipcRenderer } from 'electron'
import { defineMessage, MessageType } from './message'

export const MessageRequestManifest: MessageType<{ }> = 'request-manifest'
export const MessageInstanceManifest: MessageType<{ manifest: InstanceManifest }> = 'instance-manifest'

export const MessageSyncEntry = defineMessage(MessageRequestManifest, function (msg) {
})
