import { LanServerInfo } from '@xmcl/client'
import { createServer } from 'net'
import { defineMessage, MessageType } from './message'
import { ServerProxy } from '../ServerProxy'
import type { DataChannelInitConfig } from 'node-datachannel'
import { listen } from '../../util/server'

export const MessageLan: MessageType<LanServerInfo> = 'lan'

export const MessageLanEntry = defineMessage(MessageLan, async function (info) {
  // const pair = this.connection.getSelectedCandidatePair()
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
    this.context.onLanMessage(this.id, { motd: info.motd, port: await proxy.actualPort })
    return
  }

  console.log('Try create proxy server:')

  const server = createServer((socket) => {
    // create game data channel to pipe message
    console.log(`Create datachannel to actual port ${info.port}`)
    const init: DataChannelInitConfig = {
      protocol: 'minecraft', // protocol minecraft
      ordered: true,
    }
    if (this.lastGameChannelId) {
      init.id = this.lastGameChannelId += 2
    }
    const gameChannel = this.connection.createDataChannel(`${info.port}`, init)

    const id = gameChannel.id
    if (!this.lastGameChannelId && id) {
      this.lastGameChannelId = id
    }
    // the data send before channel connected will be buffered
    let buffers: Buffer[] = []
    let opened = false
    socket.on('data', (buf) => {
      if (!opened) {
        buffers.push(buf)
      } else if (gameChannel.readyState === 'open') {
        gameChannel.send(buf)
        // if (!gameChannel.send(buf)) {
        //   gameChannel.close()
        // }
      }
    })
    gameChannel.onmessage = (ev) => {
      socket.write(Buffer.from(ev.data))
    }

    socket.on('close', () => {
      console.log(`Close game channel due to socket closed ${info.port}(${id})`)
      if (gameChannel.readyState === 'open') {
        gameChannel.close()
      }
    })
    gameChannel.onclose = () => {
      console.log(`Destroy socket due to game channel is closed ${info.port}(${id})`)
      socket.destroy()
      gameChannel.close()
    }
    gameChannel.onerror = (e) => {
      console.log(`Game channel ${info.port}(${id}) error: %o`, e)
    }
    gameChannel.onopen = () => {
      console.log(`Game channel ${info.port}(${id}) opened!`)

      for (const buf of buffers) {
        gameChannel.send(buf)
        // if (!gameChannel.send(buf)) {
        //   break
        // }
      }
      buffers = []
      opened = true
    }
  })
  proxy = new ServerProxy(info.port, listen(server, info.port, (p) => p + 1), server)
  console.log(`Create new server proxy: ${info.port}`)
  // must first push the proxy to list to avoid race condition
  this.proxies.push(proxy)
  // find proper port
  this.context.onLanMessage(this.id, { motd: info.motd, port: await proxy.actualPort })
})
