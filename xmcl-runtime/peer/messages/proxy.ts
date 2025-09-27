import { defineMessage, MessageType } from './message'

export const MessageProxyConnect: MessageType<{
  id: string
  timestamp: number
}> = 'proxy-connect'

export const MessageProxyConnectLatency: MessageType<{
  id: string
  timestamp: number
  latency: number
}> = 'proxy-connect-latency'

export const MessageProxySubscribe: MessageType<{
  id: string
}> = 'proxy-subscribe'

export const MessageProxyConnectEntry = defineMessage(MessageProxyConnect, function (msg) {
  const id = msg.id
  const peer = this.context.getPeer(id)
  if (peer?.isDataChannelEstablished()) {
    this.send(MessageProxyConnectLatency, {
      id,
      timestamp: msg.timestamp,
      latency: peer.latency,
    })
  }
})

export const MessageProxyConnectLatencyEntry = defineMessage(
  MessageProxyConnectLatency,
  function (msg) {
    const peer = this.context.getPeer(msg.id)
    if (peer) {
      peer.latency = msg.latency
      peer.addProxy(this)
      this.context.onHeartbeat(msg.id, msg.latency)
    }
  },
)


