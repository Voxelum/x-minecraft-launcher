import { LanServerInfo } from '@xmcl/client'
import { createServer } from 'net'
import { defineMessage, MessageType } from './message'
import { ServerProxy } from '../ServerProxy'

export const MessageLan: MessageType<LanServerInfo> = 'lan'

export const MessageLanEntry = defineMessage(MessageLan, async function (info) {
  // lan message from other peer
  let proxy = this.proxies.find(p => p.originalPort === info.port)
  if (proxy) {
    if (proxy.actualPort !== -1) {
      this.host.broadcaster.broadcast({ motd: info.motd, port: proxy.actualPort })
    } else {
      // TODO: handle this
    }
    return
  }

  console.log('Try create proxy server:')

  const server = createServer((socket) => {
    // create game data channel to pipe message
    console.log(`Create datachannel to actual port ${info.port}`)
    const gameChannel = this.connection.createDataChannel(`${info.port}`, {
      protocol: 'minecraft', // protocol minecraft
    })
    console.log(`Data channel: ${gameChannel.id}`)
    // the data send before channel connected will be buffered
    socket.on('data', (buf) => gameChannel.send(buf))
    gameChannel.addEventListener('message', ({ data }) => socket.write(Buffer.from(data)))
    socket.on('close', () => gameChannel.close())
    gameChannel.addEventListener('close', () => socket.destroy())
  })
  proxy = new ServerProxy(info.port, -1, server)
  console.log(`Create new server proxy: ${info.port}`)
  // must first push the proxy to list to avoid race condition
  this.proxies.push(proxy)

  // find proper port
  let port = info.port
  for (; port <= 65535; ++port) {
    const listened = await new Promise<boolean>((resolve, reject) => {
      const handleError = (e: any) => {
        if (e.code === 'EADDRINUSE') {
          console.error(`Fail to listen: ${port}. Expect: ${info.port}`)
          resolve(false)
        } else {
          // should panic
          reject(e)
        }
      }
      server.addListener('error', handleError)
      server.listen(port, () => {
        console.log(`Attached to listen: ${port}. Expect: ${info.port}`)
        server.removeListener('error', handleError)
        console.log('Resolve true')
        resolve(true)
      })
    })

    console.log(`listened: ${listened}`)
    if (listened) {
      break
    }
  }
  proxy.actualPort = port
  this.host.broadcaster.broadcast({ motd: info.motd, port })
})
