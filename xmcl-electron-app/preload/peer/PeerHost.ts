import { MinecraftLanBroadcaster, MinecraftLanDiscover } from '@xmcl/client'
import { InstanceManifestSchema } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { ipcRenderer } from 'electron'
import { PeerSession } from './connection'
import { MessageShareManifest } from './messages/download'
import { MessageLan } from './messages/lan'
import { MessageEntry, MessageHandler } from './messages/message'

export class PeerHost {
  readonly sessions: Record<string, PeerSession> = {}
  readonly broadcaster = new MinecraftLanBroadcaster()
  readonly discover = new MinecraftLanDiscover()
  /**
   * The unique id of this host
   */
  readonly id = randomUUID()
  readonly handlers: Record<string, MessageHandler<any>> = {}

  private sharedManifest: InstanceManifestSchema | undefined

  constructor(entries: MessageEntry<any>[]) {
    this.broadcaster.bind()
    this.discover.bind().then(() => {
      console.log('discover ready')
    })

    this.discover.on('discover', (info) => {
      for (const conn of Object.values(this.sessions)) {
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
    return Object.values(this.sessions).find(c => c.remoteId === remoteId)
  }

  create(sessionId: string, remote?: string) {
    const conn = new PeerSession(this, sessionId, remote)
    this.sessions[conn.id] = conn
    console.log(`connection id ${conn.id}`)
    ipcRenderer.send('connection', { id: conn.id })
    return conn
  }

  setShareInstance(manifest?: InstanceManifestSchema) {
    this.sharedManifest = manifest
    if (manifest) {
      for (const sess of Object.values(this.sessions)) {
        sess.send(MessageShareManifest, { manifest: manifest })
      }
    }
  }

  getSharedInstance(): InstanceManifestSchema | undefined {
    return this.sharedManifest
  }

  isFileShared(file: string): boolean {
    if (this.sharedManifest) {
      const man = this.sharedManifest
      if (man) {
        if (man.files.some(v => v.path === file && v.downloads && v.downloads.some(u => u.startsWith('peer://')))) {
          return true
        }
      }
    }
    return false
  }

  drop(id: string) {
    const existed = this.sessions[id]
    if (existed) {
      existed.close()
    }
    delete this.sessions[id]
  }
}
