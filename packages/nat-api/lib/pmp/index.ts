import dgram from 'dgram'
// const assert = require('assert')
// const debug = require('debug')('nat-pmp')
import { EventEmitter } from 'events'

// Ports defined by draft
const CLIENT_PORT = 5350
const SERVER_PORT = 5351

// Opcodes
const OP_EXTERNAL_IP = 0
const OP_MAP_UDP = 1
const OP_MAP_TCP = 2
const SERVER_DELTA = 128

// Resulit codes
const RESULT_CODES: Record<number, string> = {
  0: 'Success',
  1: 'Unsupported Version',
  2: 'Not Authorized/Refused (gateway may have NAT-PMP disabled)',
  3: 'Network Failure (gateway may have not obtained a DHCP lease)',
  4: 'Out of Resources (no ports left)',
  5: 'Unsupported opcode',
}

export async function createPmpClient(gateway: string) {
  const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  socket.bind(CLIENT_PORT)
  await new Promise((resolve, reject) => {
    socket.on('listening', resolve)
    socket.on('error', reject)
  })

  const client = new PmpClient(gateway, socket)

  return client
}

export interface PmpMapOptions {
  type: 'tcp' | 'udp'
  /**
   * Private port
   */
  private: number
  /**
   * Public port
   */
  public: number

  ttl?: number
}

export class PmpClient extends EventEmitter {
  private _promise: Promise<void> = Promise.resolve()

  constructor(readonly gateway: string, readonly socket: dgram.Socket) {
    super()
  }

  map(opts: PmpMapOptions) {
    // debug('Client#portMapping()')
    let opcode: number
    switch (String(opts.type || 'tcp').toLowerCase()) {
      case 'tcp':
        opcode = OP_MAP_TCP
        break
      case 'udp':
        opcode = OP_MAP_UDP
        break
      default:
        throw new Error('"type" must be either "tcp" or "udp"')
    }
    return this._request(opcode, opts)
  }

  unmap(opts: PmpMapOptions) {
    // debug('Client#portUnmapping()')
    opts.ttl = 0
    return this.map(opts)
  }

  externalIp() {
    // debug('Client#externalIp()')
    return this._request(OP_EXTERNAL_IP)
  }

  close() {
    if (this.socket) {
      this.socket.close()
    }
  }

  /**
   * Queues a UDP request to be send to the gateway device.
   */
  private _request(op: number, obj?: PmpMapOptions) {
    // debug('Client#request()', [op, obj])

    let buf: Buffer
    let size
    let pos = 0

    let internal
    let external
    let ttl

    switch (op) {
      case OP_MAP_UDP:
      case OP_MAP_TCP:
        if (!obj) throw new Error('mapping a port requires an "options" object')

        internal = +(obj.private || 0)
        if (internal !== (internal | 0) || internal < 0) {
          throw new Error('the "private" port must be a whole integer >= 0')
        }

        external = +(obj.public || 0)
        if (external !== (external | 0) || external < 0) {
          throw new Error('the "public" port must be a whole integer >= 0')
        }

        if (obj.ttl === undefined) obj.ttl = 7200
        ttl = +(obj.ttl)
        if (ttl !== (ttl | 0)) {
          // The RECOMMENDED Port Mapping Lifetime is 7200 seconds (two hours)
          ttl = 7200
        }

        size = 12
        buf = Buffer.alloc(size)
        buf.writeUInt8(0, pos)
        pos++ // Vers = 0
        buf.writeUInt8(op, pos)
        pos++ // OP = x
        buf.writeUInt16BE(0, pos)
        pos += 2 // Reserved (MUST be zero)
        buf.writeUInt16BE(internal, pos)
        pos += 2 // Internal Port
        buf.writeUInt16BE(external, pos)
        pos += 2 // Requested External Port
        buf.writeUInt32BE(ttl, pos)
        pos += 4 // Requested Port Mapping Lifetime in Seconds
        break
      case OP_EXTERNAL_IP:
        size = 2
        buf = Buffer.alloc(size)
        // Vers = 0
        buf.writeUInt8(0, 0)
        pos++
        // OP = x
        buf.writeUInt8(op, 1)
        pos++
        break
      default:
        throw new Error('Invalid opcode: ' + op)
    }
    // assert.equal(pos, size, 'buffer not fully written!')
    const promise = new Promise<void>((resolve, reject) => {
      this.socket.once('error', (err) => {
        reject(err)
        if (this.socket) {
          this.socket.close()
        }
      })
      this.socket.once('message', (msg, rinfo) => {
        const parsed: any = { msg: msg }
        const vers = msg.readUInt8(0)
        const parsedOp = msg.readUInt8(1)

        if (parsedOp - SERVER_DELTA !== op) {
          // debug('WARN: ignoring unexpected message opcode', parsedOp)
          return
        }

        // if we got here, then we're gonna invoke the request's callback,
        // so shift this request off of the queue.
        // debug('removing "req" off of the queue')

        if (vers !== 0) {
          reject(new Error('"vers" must be 0. Got: ' + vers))
          return
        }

        // Xommon fields
        const resultCode = msg.readUInt16BE(2)
        const resultMessage = RESULT_CODES[resultCode]
        const epoch = msg.readUInt32BE(4)

        // Error
        if (resultCode !== 0) {
          const err = new Error(resultMessage)
          Object.assign(err, { code: resultCode })
          reject(err)
        } else {
          switch (op) {
            case OP_MAP_UDP:
            case OP_MAP_TCP:
              parsed.private = msg.readUInt16BE(8)
              parsed.public = msg.readUInt16BE(10)
              parsed.ttl = msg.readUInt32BE(12)
              parsed.type = (op === OP_MAP_UDP) ? 'udp' : 'tcp'
              resolve({ ...parsed, resultCode, resultMessage, epoch })
              break
            case OP_EXTERNAL_IP:
              parsed.ip = []
              parsed.ip.push(msg.readUInt8(8))
              parsed.ip.push(msg.readUInt8(9))
              parsed.ip.push(msg.readUInt8(10))
              parsed.ip.push(msg.readUInt8(11))
              resolve({ ...parsed, resultCode, resultMessage, epoch })
              break
            default:
              reject(new Error('Unknown opcode: ' + op))
          }
        }
      })
      this.socket.send(buf, 0, buf.length, SERVER_PORT, this.gateway)
    })
    this._promise = this._promise.finally(() => promise)
    return promise
  }
}
