import { LanServerInfo, MinecraftLanDiscover } from '@xmcl/client'
import { createSocket } from 'dgram'
import { MessageLan } from './messages/lan'
import type { Peers } from './multiplayerImpl'
import { EventEmitter } from 'stream'

function setup(discover: MinecraftLanDiscover, lanScope: Set<string>, allPeers: Peers) {
  discover.bind().then(() => {
    console.log('Minecraft LAN discover ready')
  }, (e) => {
    console.error(new Error('Fail to bind Minecraft LAN discover', { cause: e }))
  })

  discover.socket.on('error', (e) => {
    console.error(new Error('Minecraft discover socket error', { cause: e }))
  })

  discover.on('discover', (info) => {
    const peers = allPeers.entries.filter(c => c.connection.connectionState === 'connected')
    for (const conn of peers) {
      if (lanScope.has(conn.remoteId)) {
        return
      }

      const isFromSelf = conn.proxies.find(p =>
        // Port is created by yourself
        p.actualPortValue === info.port)
      if (isFromSelf) {
        // do not echo the proxy server you created
        return
      }
    }
    for (const conn of peers) {
      conn.send(MessageLan, info)
    }
  })
}
export const LAN_MULTICAST_PORT = 4446
export const LAN_MULTICAST_ADDR = '224.0.2.60'

export function createLanDiscover(peers: Peers, emitter: EventEmitter) {
  const discover = new MinecraftLanDiscover()
  const discoverV6 = new MinecraftLanDiscover('udp6')

  const set = new Set<string>()
  const sock = createSocket({ reuseAddr: true, type: 'udp4' })
  sock.bind(LAN_MULTICAST_PORT)

  sock.on('listening', () => {
    const address = sock.address()
    sock.addMembership(LAN_MULTICAST_ADDR, address.address)
    sock.setMulticastTTL(128)
    sock.setBroadcast(true)
  })
  sock.on('message', (buf, remote) => {
    const content = buf.toString('utf-8')
    set.add(content)
  })

  setup(discover, set, peers)
  setup(discoverV6, set, peers)

  let ports: number[] = []
  function setExposedPorts(exposed: number[]) {
    ports = exposed || []
  }

  return {
    start: (id: string) => {
      setInterval(() => {
        sock.send(id, LAN_MULTICAST_PORT, LAN_MULTICAST_ADDR)
        if (ports && ports.length > 0) {
          for (const p of ports) {
            if (discover.isReady) {
              discover.broadcast({
                port: p,
                motd: 'Minecraft Server',
              })
            }
            if (discoverV6.isReady) {
              discoverV6.broadcast({
                port: p,
                motd: 'Minecraft Server',
              })
            }
          }
        }
      }, 1000)
    },
    destroy: () => {
      sock.close()
      discover.destroy()
      discoverV6.destroy()
    },
    onLanMessage: (session: string, msg: LanServerInfo) => {
      emitter.emit('lan', { session, ...msg })
      if (!discover.isReady) {
        // discover.bind()
      } else {
        discover.broadcast(msg)
      }
      if (!discoverV6.isReady) {
        // discoverV6.bind()
      } else {
        discoverV6.broadcast(msg)
      }
    },
    setExposedPorts,
  }
}
