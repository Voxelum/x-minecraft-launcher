import { AddressInfo } from 'net'
import { Device } from './device'
import { createSsdp, Ssdp } from './ssdp'

export { createSsdp, Ssdp, Device, AddressInfo }

export async function createUpnpClient() {
  const ssdp = await createSsdp()
  const client = new UpnpClient(ssdp)
  return client
}

export const ERROR_GATEWAY_NOTFOUND = 'GatewayNotFound'

export interface GetMappingOptions {
  local?: boolean
  description?: string | RegExp
}

export interface Address {
  host?: string
  port: number
}

export interface UpnpMapOptions {
  description?: string
  protocol?: 'tcp' | 'udp'
  public: Address | number | string
  private?: Address | number | string
  /**
   * Time to live in seconds
   */
  ttl?: number
}

export interface UpnpUnmapOptions {
  protocol?: 'tcp' | 'udp'
  public: Address | number | string
}

export interface MappingInfo {
  public: Address
  private: Required<Address>
  protocol: 'tcp' | 'udp'
  enabled: boolean
  description: string
  ttl: number
  local: boolean
}

function normalize(option?: string | number | Address): Partial<Address> {
  if (!option) return {}
  if (typeof option === 'string') {
    if (!Number.isNaN(option)) {
      return { port: Number(option) }
    }
    return {}
  }
  if (typeof option === 'number') { return { port: option } }
  return option
}

export class UpnpClient {
  readonly timeout: number
  private _destroyed: boolean
  private device: Device | undefined
  private address: AddressInfo | undefined
  private expiredAt = 0
  private ttl = 300_000
  private promise: Promise<{device: Device; address: AddressInfo }> | undefined

  constructor(private ssdp: Ssdp) {
    this.timeout = 1800
    this._destroyed = false
  }

  async map(options: UpnpMapOptions) {
    if (this._destroyed) throw new Error('client is destroyed')

    const { device, address } = await this.findGateway()

    const remote = normalize(options.public)
    const remotePort = remote.port
    if (remotePort === undefined) {
      throw new Error('The options.public should assign the port of the port to expose!')
    }
    const internal = normalize(options.private)
    const internalPort = internal.port ?? remotePort

    const description = options.description || 'node:nat:upnp'
    const protocol = options.protocol ? options.protocol.toUpperCase() : 'TCP'
    let ttl = 60 * 30

    if (typeof options.ttl === 'number') ttl = options.ttl
    if (typeof options.ttl === 'string' && !isNaN(options.ttl)) ttl = Number(options.ttl)

    await device.run('AddPortMapping', {
      NewRemoteHost: remote.host,
      NewExternalPort: remotePort,
      NewProtocol: protocol,
      NewInternalPort: internalPort,
      NewInternalClient: internal.host || address.address,
      NewEnabled: 1,
      NewPortMappingDescription: description,
      NewLeaseDuration: ttl,
    })
  }

  async unmap(options: UpnpUnmapOptions) {
    if (this._destroyed) throw new Error('client is destroyed')

    const { device } = await this.findGateway()

    const remote = normalize(options.public)
    const remotePort = remote.port
    if (!remotePort) {
      throw new Error('Cannot unmap the port undefined!')
    }

    const protocol = options.protocol ? options.protocol.toUpperCase() : 'TCP'

    await device.run('DeletePortMapping', {
      NewRemoteHost: remote.host,
      NewExternalPort: remotePort,
      NewProtocol: protocol,
    })
  }

  async getMappings(options: GetMappingOptions = {}): Promise<MappingInfo[]> {
    if (this._destroyed) throw new Error('client is destroyed')

    const { device, address } = await this.findGateway()
    let results: MappingInfo[] = []

    for (let i = 0, end = false; !end; i++) {
      try {
        const entries = await device.run('GetGenericPortMappingEntry', { NewPortMappingIndex: i })

        const key = Object.keys(entries).find(k => /:GetGenericPortMappingEntryResponse/.test(k))
        if (!key) throw new Error('Incorrect response')

        const data = entries[key]

        const publicHost = ((typeof data.NewRemoteHost === 'string') && (data.NewRemoteHost || '')) ?? undefined

        const result: MappingInfo = {
          public: {
            host: publicHost,
            port: parseInt(data.NewExternalPort, 10),
          },
          private: {
            host: data.NewInternalClient,
            port: parseInt(data.NewInternalPort, 10),
          },
          protocol: data.NewProtocol.toLowerCase(),
          enabled: data.NewEnabled === '1' || data.NewEnabled === 1,
          description: data.NewPortMappingDescription,
          ttl: parseInt(data.NewLeaseDuration, 10),
          local: data.NewInternalClient === address.address,
        }

        results.push(result)
      } catch (e) {
        if (e) {
          // If we got an error on index 0, ignore it in case this router starts indicies on 1
          if (i !== 1) end = true
        }
      }
    }

    if (options.local) {
      results = results.filter((item) => item.local)
    }

    if (options.description) {
      const description = options.description
      results = results.filter((item) => {
        if (typeof item.description !== 'string') return false

        if (description instanceof RegExp) {
          return item.description.match(description) !== null
        } else {
          return item.description.indexOf(description) !== -1
        }
      })
    }

    return results
  }

  async externalIp(): Promise<string> {
    if (this._destroyed) throw new Error('client is destroyed')
    const { device } = await this.findGateway()

    const data = await device.run('GetExternalIPAddress', {})

    let key = null
    Object.keys(data).some(function (k) {
      if (!/:GetExternalIPAddressResponse$/.test(k)) return false

      key = k
      return true
    })

    if (!key) throw new Error('Incorrect response')

    return data[key].NewExternalIPAddress
  }

  async findGateway(): Promise<{ device: Device; address: AddressInfo }> {
    if (this._destroyed) throw new Error('client is destroyed')

    if (this.expiredAt < Date.now() && this.device && this.address) {
      return {
        device: this.device,
        address: this.address,
      }
    }

    if (this.promise) {
      return await this.promise
    }

    const lookup = async () => {
      const p = this.ssdp.search(
        'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      )

      const { device, address } = await new Promise<{ device: Device; address: AddressInfo }>((resolve, reject) => {
        const timeout = setTimeout(function () {
          reject(Object.assign(new Error('Fail to find gateway. Maybe your router does not support upnp!'), { error: ERROR_GATEWAY_NOTFOUND }))
        }, this.timeout)
        p.then(({ info, address }) => {
          resolve({ address, device: new Device(info.location) })
        }, reject).finally(() => {
          clearTimeout(timeout)
        })
      })

      this.device = device
      this.address = address
      this.expiredAt = Date.now() + this.ttl

      return { device, address }
    }

    this.promise = lookup().finally(() => {
      this.promise = undefined
    })

    return this.promise
  }

  destroy() {
    this._destroyed = true

    this.ssdp.destroy()
  }
}
