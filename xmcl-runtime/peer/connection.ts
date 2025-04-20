import { ConnectionUserInfo, RTCSessionDescription } from '@xmcl/runtime-api'
import { createReadStream, existsSync } from 'fs'
import debounce from 'lodash.debounce'
import { createConnection } from 'net'
import { join } from 'path'
import { Readable, Writable, finished } from 'stream'
import { PeerContext } from './PeerContext'
import { ServerProxy } from './ServerProxy'
import { MessageGetSharedManifestEntry, MessageShareManifestEntry } from './messages/download'
import { MessageHeartbeatPing, MessageHeartbeatPingEntry, MessageHeartbeatPongEntry } from './messages/heartbeat'
import { MessageIdentity, MessageIdentityEntry } from './messages/identity'
import { MessageLanEntry } from './messages/lan'
import { MessageEntry, MessageHandler, MessageType } from './messages/message'
import { WorkerQueue } from '../util/aggregator'
import { RTCDuplexChannel } from './RTCDuplexChannel'

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
  /**
   * The basic communicate channel
   */
  #channel: RTCDataChannel | undefined
  #isClosed = false
  #candidates: Array<{ candidate: string; mid: string }> = []

  /**
   * The peer client id
   */
  public remoteId = ''

  public lastGameChannelId = undefined as undefined | number
  public remoteInfo: ConnectionUserInfo | undefined

  readonly proxies: ServerProxy[] = []

  #updateDescriptor: () => void

  #interval: ReturnType<typeof setInterval>

  #channelPool: RTCDuplexChannel[] = []

  #getOrCreateDownloadChannel() {
    let idel: RTCDuplexChannel | undefined
    for (const channel of this.#channelPool) {
      if (!channel.isBusy) {
        idel = channel
        break
      }
    }
    if (idel) {
      return idel
    }
    const channel = new RTCDuplexChannel(this.connection.createDataChannel(`download-${this.#channelPool.length}`, {
      ordered: true,
      protocol: 'download',
    }), this.createStream, this.connection.sctp?.maxMessageSize ?? 16 * 1024)
    this.#channelPool.push(channel)
    return channel
  }

  #streamQueue = new WorkerQueue<{ file: string; destination: Writable }>(async ({ file, destination }) => {
    return new Promise<any>((resolve) => {
      const channel = this.#getOrCreateDownloadChannel()
      finished(destination, resolve)
      channel.download(file, destination)
    })
  }, 32, {
    shouldRetry: () => false,
    isEqual: () => false,
  })

  constructor(
    /**
    * The session id
    */
    readonly id: string,
    public connection: RTCPeerConnection,
    readonly context: PeerContext) {
    this.#updateDescriptor = debounce(() => {
      const description = this.connection.localDescription!
      context.onDescriptorUpdate(this.id, description.sdp, description.type, this.#candidates)
    }, 1500) // debounce for 1.5 second
    this.setConnection(connection)

    this.#interval = setInterval(() => {
      this.send(MessageHeartbeatPing, { time: Date.now() })
    }, 1000)
  }

  isDataChannelEstablished() {
    return this.#channel && this.#channel.readyState === 'open'
  }

  setConnection(connection: RTCPeerConnection) {
    this.connection = connection
    this.connection.addEventListener('icecandidate', (ev) => {
      const candidate = ev.candidate?.toJSON()
      if (candidate && candidate.candidate) {
        this.#candidates.push({
          candidate: candidate.candidate,
          mid: candidate.sdpMid ?? '',
        })
      }
      this.#updateDescriptor()
    })
    this.connection.addEventListener('datachannel', (e) => {
      const channel = e.channel
      const label = channel.label
      if (channel.protocol === 'minecraft') {
        // this is a minecraft game connection
        const port = Number.parseInt(channel.label)!
        console.log(`Receive minecraft game connection: ${port}`)
        const socket = createConnection(port)
        const id = channel.id
        let buffers = [] as Buffer[]
        channel.onopen = () => {
          console.log(`Game data channel ${port}(${id}) is opened!`)
          for (const buf of buffers) {
            channel.send(buf)
          }
          buffers = []
        }
        channel.onclose = () => {
          console.log(`Game connection ${id} closed and destroy socket ${label}`)
          socket.destroy()
          channel.close()
        }
        socket.on('data', (buf) => channel.readyState === 'open' ? channel.send(buf) : buffers.push(buf))
        channel.addEventListener('message', ({ data }) => socket.write(Buffer.from(data)))
        socket.on('close', () => {
          console.log(`Socket ${label} closed and close game channel ${id}`)
          if (channel.readyState === 'open') {
            channel.close()
          }
        })
        channel.addEventListener('close', () => socket.destroy())
        channel.onerror = (e) => {
          console.error(new Error(`Game data channel ${port}(${id}) error`, { cause: e }))
        }
        console.log(`Create game channel to ${port}(${id})`)
      } else if (channel.protocol === 'metadata') {
        // this is a metadata channel
        this.setChannel(e.channel)
        console.log('Metadata channel created')
      } else if (channel.protocol === 'download') {
        console.log(`Receive peer file request: ${channel.label}`)
        this.#channelPool.push(new RTCDuplexChannel(channel, this.createStream, this.connection.sctp?.maxMessageSize ?? 16 * 1024))
      } else {
        // TODO: emit error for unknown protocol
      }
    })
  }

  createStream = (filePath: string) => {
    const maxChunk = this.connection.sctp?.maxMessageSize ?? 16 * 1024
    if (filePath.startsWith('/sharing')) {
      if (filePath === '/sharing') {
        const man = this.context.getSharedInstance()
        if (!man) {
          return 'NOT_FOUND'
        }
        return new Readable({
          read() {
            const encoder = new TextEncoder()
            const buf = encoder.encode(JSON.stringify(man))
            this.push(buf)
            this.push(null)
          },
          highWaterMark: maxChunk,
        })
      }
      filePath = filePath.substring('/sharing'.length)
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1)
      }
      const man = this.context.getSharedInstance()
      if (!man) {
        return 'NO_PERMISSION'
      }
      const file = man.files.find(v => decodeURI(v.path) === filePath)
      if (!file) {
        return 'NO_PERMISSION'
      }
      const absPath = join(this.context.getShadedInstancePath(), file.path)
      if (!existsSync(absPath)) {
        return 'NOT_FOUND'
      }
      return createReadStream(absPath, {
        highWaterMark: maxChunk,
      })
    } else if (filePath.startsWith('/image')) {
      filePath = filePath.substring('/image'.length)
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1)
      }
      return createReadStream(this.context.getSharedImagePath(filePath), {
        highWaterMark: 16 * 1024,
      })
    } else if (filePath.startsWith('/assets')) {
      filePath = filePath.substring('/assets'.length)
      return createReadStream(join(this.context.getSharedAssetsPath(), filePath), {
        highWaterMark: 16 * 1024,
      })
    } else if (filePath.startsWith('/libraries')) {
      filePath = filePath.substring('/libraries'.length)
      return createReadStream(join(this.context.getSharedLibrariesPath(), filePath), {
        highWaterMark: 16 * 1024,
      })
    }
    return 'NOT_FOUND'
  }

  /**
   * Called in initiator
   */
  async initiate() {
    // host
    console.log('peer initialize')
    this.setChannel(this.connection.createDataChannel(this.id, {
      ordered: true,
      protocol: 'metadata',
    }))

    const offer = await this.connection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    })

    console.log(`Create offer ${(offer.sdp)}`)
    await this.connection.setLocalDescription(offer)

    this.#updateDescriptor()
  }

  async setRemoteDescription(remote: RTCSessionDescription) {
    if (remote.type === 'offer') {
      console.log(`Set remote offer ${remote.type} ${remote.sdp}`)
      await this.connection.setRemoteDescription(remote)
      const answer = await this.connection.createAnswer()

      console.log(`Set local description ${answer.type} ${answer.sdp}`)
      await this.connection.setLocalDescription(answer)

      this.#updateDescriptor()

      return this.connection.localDescription
    } else {
      console.log(`Set remote to ${remote.type} as answer`)
      console.log(remote.sdp)
      await this.connection.setRemoteDescription(remote)
    }
  }

  waitIceGathering() {
    return new Promise<void>((resolve) => {
      if (this.connection.iceGatheringState !== 'complete') {
        // wait ice collect state done
        const onStateChange = () => {
          if (this.connection.iceGatheringState === 'complete') {
            resolve()
          }
        }
        this.connection.addEventListener('icegatheringstatechange', onStateChange)
      } else {
        resolve()
      }
    })
  }

  /**
   * Download a file from peer
   * @param file The file path to download
   * @param destination The sink stream to receive the file content
   */
  stream(file: string, destination: Writable) {
    this.#streamQueue.push({ file, destination })
  }

  /**
   * Set metadata channel
   */
  private setChannel(channel: RTCDataChannel) {
    channel.addEventListener('message', async (e) => {
      const message = JSON.parse(e.data)
      handlers[message.type as string]?.call(this, message.payload)
    })
    channel.onopen = () => {
      console.log(`Create metadata channel on ${channel.id}`)
      const info = this.context.getUserInfo()
      this.send(MessageIdentity, { ...info })
    }
    channel.onerror = (e) => {
      console.error(new Error('Fail to create metadata channel', { cause: e }))
    }
    channel.onclose = () => {
      this.close()
    }
    this.#channel = channel
  }

  get isClosed() { return this.#isClosed }

  close() {
    this.#isClosed = true

    if (this.#channel && this.#channel.readyState === 'open') {
      console.log(`Metadata channel closed: ${this.#channel.id}`)
      this.#channel.close()
    }
    this.connection.close()
    for (const p of this.proxies) {
      p.server.close()
    }
    clearInterval(this.#interval!)
  }

  send<T>(type: MessageType<T>, data: T) {
    if (this.connection.connectionState !== 'connected' || !this.#channel || this.#channel.readyState !== 'open') {
      return
    }
    this.#channel?.send(JSON.stringify({ type: type as string, payload: data }))
  }
}
