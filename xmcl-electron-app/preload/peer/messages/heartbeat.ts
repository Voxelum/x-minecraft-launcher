import { ipcRenderer } from 'electron'
import { defineMessage, MessageType } from './message'

export const MessageHeartbeatPing: MessageType<{ time: number }> = 'heartbeat-ping'
export const MessageHeartbeatPong: MessageType<{ time: number }> = 'heartbeat-pong'

export const MessageHeartbeatPingEntry = defineMessage(MessageHeartbeatPing, function (msg) {
  this.send(MessageHeartbeatPong, { time: msg.time })
})

export const MessageHeartbeatPongEntry = defineMessage(MessageHeartbeatPong, function (msg) {
  ipcRenderer.send('peer-heartbeat', { id: this.id, ping: Date.now() - msg.time })
})
