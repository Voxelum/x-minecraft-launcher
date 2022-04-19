import { MinecraftLanBroadcaster, MinecraftLanDiscover } from '@xmcl/client'
import { randomUUID } from 'crypto'
import { ipcRenderer } from 'electron'
import { PeerSession } from './connection'
import { MessageLan } from './messages/lan'
import { MessageEntry, MessageHandler } from './messages/message'

export class PeerHost {
  readonly connections: Record<string, PeerSession> = {}
  readonly broadcaster = new MinecraftLanBroadcaster()
  readonly discover = new MinecraftLanDiscover()
  /**
   * The unique id of this host
   */
  readonly id = randomUUID()
  readonly handlers: Record<string, MessageHandler<any>> = {}

  constructor(entries: MessageEntry<any>[]) {
    this.broadcaster.bind()
    this.discover.bind().then(() => {
      console.log('discover ready')
    })

    this.discover.on('discover', (info) => {
      for (const conn of Object.values(this.connections)) {
        if (conn.connection.connectionState !== 'connected') {
          continue
        }
        const selfMessage = conn.proxies.find(p => p.actualPort === info.port)
        // do not echo the proxy server you created
        if (!selfMessage) {
          conn.send(MessageLan, info)
        }
      }
    })

    for (const { type, handler } of entries) {
      this.handlers[type as string] = handler
    }
  }

  getByRemoteId(remoteId: string) {
    return Object.values(this.connections).find(c => c.remoteId === remoteId)
  }

  create(sessionId: string, remote?: string) {
    const conn = new PeerSession(this, sessionId, remote)
    this.connections[conn.id] = conn
    console.log(`connection id ${conn.id}`)
    ipcRenderer.send('connection', { id: conn.id })
    return conn
  }

  drop(id: string) {
    const existed = this.connections[id]
    if (existed) {
      existed.close()
    }
    delete this.connections[id]
  }
}
