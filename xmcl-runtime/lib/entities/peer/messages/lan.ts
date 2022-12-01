import { LanServerInfo } from '@xmcl/client'
import { createServer } from 'net'
import { defineMessage, MessageType } from './message'
import { ServerProxy } from '../ServerProxy'
import { listen } from '../../../util/server'
import { DataChannelInitConfig } from 'node-datachannel'

export const MessageLan: MessageType<LanServerInfo> = 'lan'

export const MessageLanEntry = defineMessage(MessageLan, async function (info) {
  const pair = this.connection.getSelectedCandidatePair()
  // if (pair && pair.remote.type === 'host') {
  // 'host' means we are in same local network or public network
  // return
  // }
  // lan message from other peer
  let proxy = this.proxies.find(p =>
    // this port proxy is already created
    p.originalPort === info.port)
  if (proxy) {
    // Re-broadcast message
    this.host.onLanMessage(this.id, { motd: info.motd, port: await proxy.actualPort })
    return
  }

  this.logger.log('Try create proxy server:')

  const server = createServer((socket) => {
    // create game data channel to pipe message
    this.logger.log(`Create datachannel to actual port ${info.port}`)
    const init: DataChannelInitConfig = {
      protocol: 'minecraft', // protocol minecraft
      ordered: true,
    }
    if (this.lastGameChannelId) {
      init.id = this.lastGameChannelId += 2
    }
    const gameChannel = this.connection.createDataChannel(`${info.port}`, init)

    const id = gameChannel.getId()
    if (!this.lastGameChannelId) {
      this.lastGameChannelId = id
    }
    // the data send before channel connected will be buffered
    let buffers: Buffer[] = []
    let opened = false
    socket.on('data', (buf) => {
      if (!opened) {
        buffers.push(buf)
      } else if (gameChannel.isOpen()) {
        if (!gameChannel.sendMessageBinary(buf)) {
          gameChannel.close()
        }
      }
    })
    gameChannel.onMessage((data) => {
      socket.write(data)
    })

    socket.on('close', () => {
      this.logger.log(`Close game channel due to socket closed ${info.port}(${id})`)
      if (gameChannel.isOpen()) {
        gameChannel.close()
      }
    })
    gameChannel.onClosed(() => {
      this.logger.log(`Destroy socket due to game channel is closed ${info.port}(${id})`)
      socket.destroy()
      gameChannel.close()
    })
    gameChannel.onError((e) => {
      this.logger.log(`Game channel ${info.port}(${id}) error: %o`, e)
    })
    gameChannel.onOpen(() => {
      this.logger.log(`Game channel ${info.port}(${id}) opened!`)

      for (const buf of buffers) {
        if (!gameChannel.sendMessageBinary(buf)) {
          break
        }
      }
      buffers = []
      opened = true
    })
  })
  proxy = new ServerProxy(info.port, listen(server, info.port, (p) => p + 1), server)
  this.logger.log(`Create new server proxy: ${info.port}`)
  // must first push the proxy to list to avoid race condition
  this.proxies.push(proxy)
  // find proper port
  this.host.onLanMessage(this.id, { motd: info.motd, port: await proxy.actualPort })
})
