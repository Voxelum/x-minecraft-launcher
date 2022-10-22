import { createConnection } from 'net'
import { DataChannel, DataChannelStream, PeerConnection } from 'node-datachannel'
import { MessageGetSharedManifestEntry, MessageShareManifestEntry } from './messages/download'
import { MessageHeartbeatPing, MessageHeartbeatPingEntry, MessageHeartbeatPongEntry } from './messages/heartbeat'
import { MessageIdentity, MessageIdentityEntry } from './messages/identity'
import { MessageLanEntry } from './messages/lan'
import { MessageEntry, MessageHandler, MessageType } from './messages/message'
import { PeerHost } from './PeerHost'
import { ServerProxy } from './ServerProxy'
import { iceServers } from './stun'
import { Logger } from '/@main/util/log'

const getRegistry = (entries: MessageEntry<any>[]) => {
  const reg: Record<string, MessageHandler<any>> = {}
  for (const e of entries) {
    reg[e.type as string] = e.handler
  }
  return reg
}

const handlers = getRegistry([
  MessageLanEntry,
  MessageIdentityEntry,
  MessageShareManifestEntry,
  MessageHeartbeatPingEntry,
  MessageHeartbeatPongEntry,
  MessageGetSharedManifestEntry,
])

export class PeerSession {
  readonly connection: PeerConnection
  /**
   * The basic communicate channel
   */
  private channel: DataChannel | undefined

  readonly proxies: ServerProxy[] = []

  constructor(
    readonly host: PeerHost,
    readonly logger: Logger,
    /**
     * The receiver id
     */
    readonly id: string,
  ) {
    // TODO: see this id
    this.connection = new PeerConnection(id, {
      iceServers,
      iceTransportPolicy: 'all',
    })

    this.connection.onDataChannel((channel) => {
      const protocol = channel.getProtocol()
      const label = channel.getLabel()
      if (protocol === 'minecraft') {
        // this is a minecraft game connection
        const port = Number.parseInt(label)!
        this.logger.log(`Receive minecraft game connection: ${port}`)
        const socket = createConnection(port)
        socket.on('data', (buf) => channel.sendMessageBinary(buf))
        channel.onMessage((data) => socket.write(Buffer.from(data)))
        socket.on('close', () => channel.close())
        channel.onClosed(() => socket.destroy())
        this.logger.log(`Create game channel to ${port}`)
      } else if (protocol === 'metadata') {
        // this is a metadata channel
        this.setChannel(channel)
        this.logger.log('Metadata channel created')
      } else if (protocol === 'download') {
        this.logger.log(`Receive peer file request: ${label}`)
        let fileName = unescape(label)
        if (fileName.startsWith('/')) {
          fileName = fileName.substring(1)
        }
        const fileStream = this.host.createSharedFileReadStream(fileName)
        if (fileStream) {
          this.logger.log(`Process peer file request: ${fileName}`)
          fileStream.on('data', (data: Buffer) => {
            channel.sendMessageBinary(data)
          })
          fileStream.on('close', () => {
            channel.close()
          })
          channel.onMessage((data) => {
            if (data === 'done') {
              fileStream.destroy()
              channel.close()
            }
          })
        } else {
          // reject the file
          this.logger.log(`Reject peer file request as it's not shared: ${fileName}`)
          channel.close()
        }
      } else {
        // TODO: emit error for unknown protocol
      }
    })
  }

  /**
   * Called in initiator
   */
  async initiate() {
    // host
    this.logger.log('peer initialize')
    this.setChannel(this.connection.createDataChannel(this.id, { ordered: true, protocol: 'metadata' }))
  }

  createDownloadStream(file: string) {
    return new DataChannelStream(this.connection.createDataChannel(file, {
      protocol: 'download',
    }))
  }

  waitIceGathering() {
    return new Promise<void>((resolve) => {
      if (this.connection.gatheringState() !== 'complete') {
        // wait ice collect state done
        const onStateChange = (state: string) => {
          if (state === 'complete') {
            resolve()
          }
        }
        this.connection.onGatheringStateChange(onStateChange)
      } else {
        resolve()
      }
    })
  }

  /**
   * Set metadata channel
   */
  private setChannel(channel: DataChannel) {
    channel.onMessage(async (data) => {
      if (typeof data === 'string') {
        const message = JSON.parse(data)
        handlers[message.type as string]?.call(this, message.payload)
      }
    })
    channel.onOpen(() => {
      const info = this.host.getUserInfo()
      this.send(MessageIdentity, { ...info })
    })
    channel.onClosed(() => {
      this.close()
    })
    this.channel = channel
    setInterval(() => {
      this.send(MessageHeartbeatPing, { time: Date.now() })
    }, 1000)
  }

  close() {
    this.connection.close()
    this.channel?.close()
    for (const p of this.proxies) {
      p.server.close()
    }
  }

  send<T>(type: MessageType<T>, data: T) {
    if (this.connection.state() !== 'connected') {
      return
    }
    this.channel?.sendMessage(JSON.stringify({ type: type as string, payload: data }))
  }
}
