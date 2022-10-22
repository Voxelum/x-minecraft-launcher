import { LanServerInfo } from '@xmcl/client'
import { createServer } from 'net'
import { defineMessage, MessageType } from './message'
import { ServerProxy } from '../ServerProxy'

export const MessageLan: MessageType<LanServerInfo> = 'lan'

export const MessageLanEntry = defineMessage(MessageLan, async function (info) {
  // lan message from other peer
  let proxy = this.proxies.find(p => p.originalPort === info.port)
  if (proxy) {
    // Re-broadcast message
    this.host.broadcaster.broadcast({ motd: info.motd, port: await proxy.actualPort })
    return
  }

  this.logger.log('Try create proxy server:')

  const server = createServer((socket) => {
    // create game data channel to pipe message
    this.logger.log(`Create datachannel to actual port ${info.port}`)
    const gameChannel = this.connection.createDataChannel(`${info.port}`, {
      protocol: 'minecraft', // protocol minecraft
    })
    this.logger.log(`Data channel: ${gameChannel.getId()}`)
    // the data send before channel connected will be buffered
    socket.on('data', (buf) => gameChannel.sendMessageBinary(buf))
    gameChannel.onMessage((data) => socket.write(Buffer.from(data)))
    socket.on('close', () => gameChannel.close())
    gameChannel.onClosed(() => socket.destroy())
  })
  const findPort = async () => {
    let port = info.port
    for (; port <= 65535; ++port) {
      const listened = await new Promise<boolean>((resolve, reject) => {
        const handleError = (e: any) => {
          if (e.code === 'EADDRINUSE') {
            this.logger.error(`Fail to listen: ${port}. Expect: ${info.port}`)
            resolve(false)
          } else {
            // should panic
            reject(e)
          }
        }
        server.addListener('error', handleError)
        server.listen(port, () => {
          this.logger.log(`Attached to listen: ${port}. Expect: ${info.port}`)
          server.removeListener('error', handleError)
          this.logger.log('Resolve true')
          resolve(true)
        })
      })

      this.logger.log(`listened: ${listened}`)
      if (listened) {
        break
      }
    }
    return port
  }

  proxy = new ServerProxy(info.port, findPort(), server)
  this.logger.log(`Create new server proxy: ${info.port}`)
  // must first push the proxy to list to avoid race condition
  this.proxies.push(proxy)
  // find proper port
  this.host.broadcaster.broadcast({ motd: info.motd, port: await proxy.actualPort })
})
