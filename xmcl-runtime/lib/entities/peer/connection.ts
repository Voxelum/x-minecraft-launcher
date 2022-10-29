import { randomUUID } from 'crypto'
import { createReadStream, existsSync } from 'fs'
import debounce from 'lodash.debounce'
import { createConnection } from 'net'
import { DataChannel, DataChannelStream, DescriptionType, PeerConnection } from 'node-datachannel'
import { join } from 'path'
import { Readable } from 'stream'
import { MessageGetSharedManifestEntry, MessageShareManifestEntry } from './messages/download'
import { MessageHeartbeatPing, MessageHeartbeatPingEntry, MessageHeartbeatPongEntry } from './messages/heartbeat'
import { MessageIdentity, MessageIdentityEntry } from './messages/identity'
import { MessageLanEntry } from './messages/lan'
import { MessageEntry, MessageHandler, MessageType } from './messages/message'
import { PeerHost } from './PeerHost'
import { ServerProxy } from './ServerProxy'
import { iceServers } from './stun'
import { Logger } from '/@main/util/log'
import { createPromiseSignal } from '/@main/util/promiseSignal'

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

  public description: { sdp: string; type: DescriptionType } | undefined
  readonly candidates: Array<{ candidate: string; mid: string }> = []
  private remoteId = ''
  #isClosed = false

  constructor(
    /**
     * The session id
     */
    readonly id: string = randomUUID(),
    readonly host: PeerHost,
    readonly logger: Logger,
    portBegin?: number,
  ) {
    this.connection = new PeerConnection(this.id, {
      iceServers,
      iceTransportPolicy: 'all',
      enableIceTcp: true,
      enableIceUdpMux: true,
      disableAutoNegotiation: false,
      portRangeBegin: portBegin,
    })

    const updateDescriptor = debounce(() => {
      const description = this.description!
      host.onDescriptorUpdate(this.id, description.sdp, description.type, this.candidates)
    }, 1500) // debounce for 1.5 second

    this.connection.onLocalCandidate((candidate, mid) => {
      this.candidates.push({ candidate, mid })
      updateDescriptor()
    })
    this.connection.onLocalDescription((sdp, type) => {
      this.description = { sdp, type }
      updateDescriptor()
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
        socket.on('close', () => {
          this.logger.log(`Socket ${label} closed and close game channel ${channel.getId()}`)
          channel.close()
        })
        channel.onClosed(() => {
          this.logger.log(`Game connection ${channel.getId()} closed and destroy socket ${label}`)
          socket.destroy()
        })
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
        const sharedManifest = this.host.getSharedInstance()
        const createStream = (file: string) => {
          const man = sharedManifest
          if (!man) {
            return 'NO_PERMISSION'
          }
          if (!man.files.some(v => v.path === file)) {
            return 'NO_PERMISSION'
          }
          const filePath = join(this.host.getShadedInstancePath(), file)
          if (!existsSync(filePath)) {
            return 'NOT_FOUND'
          }
          return createReadStream(filePath)
        }
        const result = createStream(fileName)
        if (typeof result === 'string') {
          // reject the file
          this.logger.log(`Reject peer file request ${fileName} due to ${result}`)
          channel.sendMessage(result)
          channel.close()
        } else {
          this.logger.log(`Process peer file request: ${fileName}`)
          result.on('data', (data: Buffer) => {
            channel.sendMessageBinary(data)
          })
          result.on('close', () => {
            channel.close()
          })
          channel.onMessage((data) => {
            if (data === 'done') {
              result.destroy()
              channel.close()
            }
          })
        }
      } else {
        // TODO: emit error for unknown protocol
      }
    })
  }

  setRemoteId(id: string) {
    this.remoteId = id
  }

  getRemoteId() {
    return this.remoteId
  }

  /**
   * Called in initiator
   */
  initiate() {
    // host
    this.logger.log('peer initialize')
    this.setChannel(this.connection.createDataChannel(this.id, { ordered: true, protocol: 'metadata' }))
  }

  createDownloadStream(file: string) {
    const readable = new Readable({
      read() {
      },
    })

    const channel = this.connection.createDataChannel(file, {
      protocol: 'download',
      ordered: true,
    })

    const onError = (e: Error) => {
      channel.close()
    }
    channel.onMessage((msg) => {
      if (typeof msg === 'string') {
        readable.destroy(new Error(msg))
      } else {
        readable.push(msg)
      }
    })
    readable.on('error', onError)
    channel.onClosed(() => {
      readable.push(null)
    })
    channel.onError((e) => {
      readable.destroy(new Error(e))
    })

    return readable
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

  get isClosed() { return this.#isClosed }

  close() {
    this.#isClosed = true
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
