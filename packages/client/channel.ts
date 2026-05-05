import { ByteBuffer } from '@xmcl/bytebuffer'
import { EventEmitter } from 'events'
import { NetConnectOpts, Socket } from 'net'
import { Transform, TransformCallback, TransformOptions, Writable } from 'stream'
import { unzip } from 'zlib'
import { Coder } from './coders'
import { PacketRegistryEntry, Side, PacketMetadata } from './packet'

export type State = keyof States
interface States {
  handshake: PacketCoders
  login: PacketCoders
  status: PacketCoders
  play: PacketCoders
}

/**
 * The channel for send and listen the Minecraft packet.
 */
export class Channel extends EventEmitter {
  state: State = 'handshake'

  private readonly states = {
    client: {
      handshake: new PacketCoders(),
      login: new PacketCoders(),
      status: new PacketCoders(),
      play: new PacketCoders(),
    },
    server: {
      handshake: new PacketCoders(),
      login: new PacketCoders(),
      status: new PacketCoders(),
      play: new PacketCoders(),
    },
  }

  private connection: Socket = new Socket({ allowHalfOpen: false })

  private outbound: Writable
  private inbound: Writable
  private listened = false

  private enableCompression = false
  private compressionThreshold = -1

  constructor() {
    super()
    this.outbound = new MinecraftPacketEncoder(this)
    this.outbound.pipe(new MinecraftPacketOutbound()).pipe(this.connection)

    this.inbound = new MinecraftPacketInBound()
    this.inbound
      .pipe(
        new PacketDecompress({
          get enableCompression() {
            return false
          },
          get compressionThreshold() {
            return -1
          },
        }),
      )
      .pipe(new MinecraftPacketDecoder(this))
      .pipe(new PacketEmitter(this))

    this.connection.pipe(this.inbound)
  }

  /**
   * Is the connection ready to read and write
   */
  get ready() {
    return this.connection.readable && this.connection.writable && this.listened
  }

  findCoderById(packetId: number, side: Side): Coder<any> {
    const all = this.states[side][this.state]
    return all.packetIdCoders[packetId]
  }

  getPacketId(packetInst: any, side: Side): number {
    const packetName = Object.getPrototypeOf(packetInst).constructor.name
    const all = this.states[side][this.state]
    return all.packetNameToId[packetName]
  }

  registerPacketType(clazz: new (...args: any) => any) {
    const entry: PacketRegistryEntry = clazz.prototype[PacketMetadata]
    const { state, side, id, name, coder } = entry
    const coders = this.states[side][state]
    coders.packetIdCoders[id] = coder
    coders.packetNameToId[name] = id
  }

  registerPacket(entry: PacketRegistryEntry) {
    const { state, side, id, name, coder } = entry
    const coders = this.states[side][state]
    coders.packetIdCoders[id] = coder
    coders.packetNameToId[name] = id
  }

  /**
   * Open the connection and start to listen the port.
   */
  async listen(option: NetConnectOpts & { keepalive?: boolean | number }) {
    await new Promise<void>((resolve, reject) => {
      this.connection.connect(option, () => {
        resolve()
      })
      if (option.timeout) {
        this.connection.setTimeout(option.timeout)
      }
      if (option.keepalive) {
        this.connection.setKeepAlive(
          true,
          typeof option.keepalive === 'boolean' ? 3500 : option.keepalive,
        )
      }
      this.connection.once('error', (e) => {
        reject(e)
      })
      this.connection.once('timeout', () => {
        reject(new Error('Connection timeout.'))
      })
    })
    this.connection.on('error', (e) => {
      this.emit('error', e)
    })

    this.emit('listen')
    this.listened = true
  }

  disconnect() {
    if (!this.listened || !this.ready) {
      return Promise.resolve()
    }
    this.listened = false
    return new Promise<void>((resolve, reject) => {
      this.connection.once('close', (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
      this.connection.end()
    })
  }

  /**
   * Sent a packet to server.
   */
  send<T>(message: T, skeleton?: Partial<T>) {
    if (!this.connection.writable) {
      throw new Error("Cannot write if the connection isn't writable!")
    }
    if (skeleton) {
      Object.assign(message as any, skeleton)
    }
    return new Promise<void>((resolve, reject) => {
      this.outbound.write(message, (err) => {
        if (err) {
          reject(err)
        } else {
          this.emit('send', message)
          resolve()
        }
      })
    })
  }

  /**
   * Listen for sepcific packet by its class name.
   */
  onPacket<T>(packet: new (...args: any[]) => T, listener: (event: T) => void): this {
    return this.on(`packet:${packet.name}`, listener)
  }

  oncePacket<T>(packet: new (...args: any[]) => T, listener: (event: T) => void): this {
    return this.once(`packet:${packet.name}`, listener)
  }
}

export interface Channel extends EventEmitter {
  on<T>(channel: string, listener: (event: T) => void): this
  once<T>(channel: string, listener: (event: T) => void): this
}

export abstract class PacketInBound extends Transform {
  private buffer: ByteBuffer = ByteBuffer.allocate(1024)

  protected abstract readPacketLength(bb: ByteBuffer): number

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    this.buffer.ensureCapacity(chunk.length + this.buffer.offset)
    this.buffer.append(chunk)
    this.buffer.flip()

    let unresolvedBytes
    do {
      const packetLength = this.readPacketLength(this.buffer)
      unresolvedBytes = this.buffer.remaining()

      if (packetLength <= unresolvedBytes) {
        const result = Buffer.alloc(packetLength)
        // TODO: check if this src refactor is correct
        const src = Buffer.from(this.buffer.buffer)
        src.copy(result, 0, this.buffer.offset, this.buffer.offset + packetLength)
        this.push(result)

        src.copyWithin(0, packetLength) // clear emitted bytes
        this.buffer.offset = 0 // reset read offset to the front
        this.buffer.limit -= packetLength // reduce the limit by emitted bytes

        unresolvedBytes -= packetLength
      } else {
        this.buffer.offset = this.buffer.limit
        this.buffer.limit = this.buffer.capacity()
        break
      }
    } while (unresolvedBytes > 0)
    callback()
  }
}

class MinecraftPacketInBound extends PacketInBound {
  protected readPacketLength(bb: ByteBuffer): number {
    return bb.readVarint32()
  }
}

class PacketDecompress extends Transform {
  constructor(
    private option: { readonly enableCompression: boolean; readonly compressionThreshold: number },
  ) {
    super()
  }

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    if (!this.option.enableCompression) {
      this.push(chunk)
      callback()
      return
    }
    const message = ByteBuffer.wrap(chunk)
    const dataLength = message.readVarint32()
    if (dataLength === 0 || dataLength < this.option.compressionThreshold) {
      this.push(message.buffer.slice(message.offset))
      callback()
    } else {
      const compressedContent = message.buffer.slice(message.offset)
      unzip(compressedContent, (err, result) => {
        if (err) {
          callback(err)
        } else {
          this.push(result)
          callback()
        }
      })
    }
  }
}

export interface PacketRegistry {
  findCoderById(packetId: number, side: 'client' | 'server'): Coder<any>
  getPacketId(message: any, side: 'client' | 'server'): number
}

export abstract class PacketDecoder extends Transform {
  constructor(private client: PacketRegistry) {
    super({ writableObjectMode: true, readableObjectMode: true })
  }

  abstract readPacketId(message: ByteBuffer): number

  _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
    const message = ByteBuffer.wrap(chunk)
    const packetId = this.readPacketId(message)
    const packetContent = message.slice()
    const coder = this.client.findCoderById(packetId, 'server')
    if (coder) {
      this.push(coder.decode(packetContent))
    } else {
      console.error(`Unknown packet ${packetId} : ${packetContent.buffer}.`)
    }
    callback()
  }
}

class MinecraftPacketDecoder extends PacketDecoder {
  readPacketId(message: ByteBuffer): number {
    return message.readVarint32()
  }
}

export class PacketEmitter extends Writable {
  constructor(private eventBus: EventEmitter) {
    super({ objectMode: true })
  }

  _write(inst: any, encoding: string, callback: (error?: Error | null) => void): void {
    this.eventBus.emit(`packet:${Object.getPrototypeOf(inst).constructor.name}`, inst)
    callback()
  }
}

export abstract class PacketEncoder extends Transform {
  constructor(private client: PacketRegistry) {
    super({ writableObjectMode: true, readableObjectMode: true })
  }

  protected abstract writePacketId(bb: ByteBuffer, id: number): void

  _transform(message: any, encoding: string, callback: TransformCallback) {
    const id = this.client.getPacketId(message, 'client')
    const coder = this.client.findCoderById(id, 'client')
    if (coder && coder.encode) {
      const buf = new ByteBuffer()
      this.writePacketId(buf, id)
      coder.encode(buf, message, this.client)
      buf.flip()
      const arr = buf.buffer.slice(0, buf.limit)
      this.push(Buffer.from(arr))
      callback()
    } else {
      callback(new Error(`Cannot find coder for message. ${JSON.stringify(message)}`))
    }
  }
}

class MinecraftPacketEncoder extends PacketEncoder {
  protected writePacketId(bb: ByteBuffer, id: number): void {
    bb.writeByte(id)
  }
}

export abstract class PacketOutbound extends Transform {
  protected abstract writePacketLength(bb: ByteBuffer, len: number): void

  constructor(
    private channelWidth = Number.MAX_SAFE_INTEGER,
    opts?: TransformOptions,
  ) {
    super(opts)
  }

  _transform(packet: Buffer, encoding: string, callback: TransformCallback) {
    const buffer = new ByteBuffer()

    this.writePacketLength(buffer, packet.length)
    buffer.append(packet)
    buffer.flip()

    let bytesToSend = buffer.remaining()
    while (bytesToSend > 0) {
      const toSend = Math.min(bytesToSend, this.channelWidth)
      const chunk = buffer.readBytes(toSend)
      this.push(Buffer.from(chunk.toBuffer()))
      bytesToSend -= toSend
    }

    callback()
  }
}

class MinecraftPacketOutbound extends PacketOutbound {
  protected writePacketLength(bb: ByteBuffer, len: number): void {
    bb.writeVarint32(len)
  }
}

class PacketCoders {
  packetIdCoders: { [packetId: number]: Coder<any> } = {}
  packetNameToId: { [name: string]: number } = {}
}
