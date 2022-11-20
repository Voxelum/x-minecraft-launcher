import { LanServerInfo } from '@xmcl/client'
import { createServer } from 'net'
import { defineMessage, MessageType } from './message'
import { ServerProxy } from '../ServerProxy'
import { listen } from '../../../util/server'

export const MessageLan: MessageType<LanServerInfo> = 'lan'

export const MessageLanEntry = defineMessage(MessageLan, async function (info) {
  // lan message from other peer
  let proxy = this.proxies.find(p => p.originalPort === info.port)
  if (proxy) {
    // Re-broadcast message
    this.host.onLanMessage(this.id, { motd: info.motd, port: await proxy.actualPort })
    return
  }

  this.logger.log('Try create proxy server:')

  const server = createServer((socket) => {
    // create game data channel to pipe message
    this.logger.log(`Create datachannel to actual port ${info.port}`)
    const gameChannel = this.connection.createDataChannel(`${info.port}`, {
      protocol: 'minecraft', // protocol minecraft
      ordered: true,
    })
    this.logger.log(`Data channel: ${gameChannel.getId()}`)
    // the data send before channel connected will be buffered
    socket.on('data', (buf) => gameChannel.sendMessageBinary(buf))
    gameChannel.onMessage((data) => socket.write(Buffer.from(data)))
    socket.on('close', () => gameChannel.close())
    gameChannel.onClosed(() => socket.destroy())
  })
  proxy = new ServerProxy(info.port, listen(server, info.port, (p) => p + 1), server)
  this.logger.log(`Create new server proxy: ${info.port}`)
  // must first push the proxy to list to avoid race condition
  this.proxies.push(proxy)
  // find proper port
  this.host.onLanMessage(this.id, { motd: info.motd, port: await proxy.actualPort })
})
