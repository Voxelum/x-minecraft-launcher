import { defineMessage, MessageType } from './message'

export const MessageHeartbeatPing: MessageType<{ time: number }> = 'heartbeat-ping'
export const MessageHeartbeatPong: MessageType<{ time: number }> = 'heartbeat-pong'

export const MessageHeartbeatPingEntry = defineMessage(MessageHeartbeatPing, function (msg) {
  this.send(MessageHeartbeatPong, { time: msg.time })
})

export const MessageHeartbeatPongEntry = defineMessage(MessageHeartbeatPong, function (msg) {
  this.host.onHeartbeat(this.id, Math.floor((Date.now() - msg.time) / 2))
})
