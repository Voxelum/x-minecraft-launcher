import dgram, { RemoteInfo, Socket } from 'dgram'
import { EventEmitter } from 'events'
import { AddressInfo } from 'net'
import os, { NetworkInterfaceInfo } from 'os'

const MULTICAST_IP_ADDRESS = '239.255.255.250'
const MULTICAST_PORT = 1900

export interface SsdpSearchResult {
  info: Record<string, string>
  address: AddressInfo
}

export async function createSsdp(options: { sourcePort?: number } = {}) {
  // Create sockets on all external interfaces
  const interfaces = os.networkInterfaces()
  const sourcePort = options.sourcePort ?? 0

  function createSocket(interf: NetworkInterfaceInfo) {
    const socket = dgram.createSocket(interf.family === 'IPv4' ? 'udp4' : 'udp6')

    return new Promise<dgram.Socket | undefined>((resolve, reject) => {
      socket.on('listening', () => {
        resolve(socket)
      })
      socket.on('error', (e) => {
        // Ignore errors

        if (socket) {
          socket.close()
          // Force trigger onClose() - 'close()' does not guarantee to emit 'close'
        }

        resolve(undefined)
      })
      // socket.address = interf.address
      socket.bind(sourcePort, interf.address)
    })
  }

  const sockets = await Promise.all(Object.values(interfaces).map(infos => infos?.filter((info) => !info.internal).map((item) => createSocket(item)) || [])
    .reduce((a, b) => [...a, ...b], []))

  return new Ssdp(sourcePort, sockets.filter((s): s is Socket => !!s))
}

export class Ssdp extends EventEmitter {
  readonly multicast: string
  readonly port: number

  private _destroyed: boolean

  constructor(
    readonly sourcePort: number,
    readonly sockets: dgram.Socket[],
  ) {
    super()

    this.multicast = MULTICAST_IP_ADDRESS
    this.port = MULTICAST_PORT

    this._destroyed = false

    for (const socket of sockets) {
      socket.on('message', (message, info) => {
        // Ignore messages after closing sockets
        if (this._destroyed) return

        // Parse response
        this._parseResponse(message.toString(), socket.address(), info)
      })
      const onClose = () => {
        if (socket) {
          const index = this.sockets.indexOf(socket)
          this.sockets.splice(index, 1)
        }
      }

      // On error - remove socket from list and execute items from queue
      socket.on('close', () => {
        onClose()
      })
    }
  }

  search(device: string) {
    if (this._destroyed) throw new Error('client is destroyed')

    return new Promise<SsdpSearchResult>((resolve, reject) => {
      const query = Buffer.from(
        'M-SEARCH * HTTP/1.1\r\n' +
        'HOST: ' + this.multicast + ':' + this.port + '\r\n' +
        'MAN: "ssdp:discover"\r\n' +
        'MX: 1\r\n' +
        'ST: ' + device + '\r\n' +
        '\r\n',
      )

      // Send query on each socket
      for (const socket of this.sockets) {
        socket.send(query, 0, query.length, this.port, this.multicast)
      }

      const onDevice = (info: Record<string, string>, address: AddressInfo) => {
        if (info.st !== device) return
        this.removeListener('_device', onDevice)
        resolve({
          info,
          address,
        })
      }
      this.on('_device', onDevice)
    })
  }

  // TODO create separate logic for parsing unsolicited upnp broadcasts,
  // if and when that need arises
  private _parseResponse(response: string, addr: AddressInfo, remote: RemoteInfo) {
    if (this._destroyed) return

    // Ignore incorrect packets
    if (!/^(HTTP|NOTIFY)/m.test(response)) return

    const headers = this._parseMimeHeader(response)

    // Messages that match the original search target
    if (!headers.st) return

    this.emit('_device', headers, addr)
  }

  private _parseMimeHeader(headerStr: string): Record<string, string> {
    const lines = headerStr.split(/\r\n/g)

    // Parse headers from lines to hashmap
    return lines.reduce((headers, line) => {
      line.replace(/^([^:]*)\s*:\s*(.*)$/, (a, key, value) => {
        headers[key.toLowerCase()] = value
        return a
      })
      return headers
    }, {} as Record<string, string>)
  }

  destroy() {
    this._destroyed = true

    while (this.sockets.length > 0) {
      const socket = this.sockets.shift()
      if (socket) {
        socket.close()
      }
    }
  }
}
