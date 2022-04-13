import { Agents, DownloadBaseOptions } from '@xmcl/installer'
// import NatAPI from 'nat-api'
import { UpnpClient } from '@xmcl/nat-api'
import { BaseServiceKey } from '@xmcl/runtime-api'
import { getNatInfoUDP, NatInfo } from '@xmcl/stun-client'
import got, { Got } from 'got'
import { Socket } from 'net'
import { cpus } from 'os'
import { URL } from 'url'
import { Manager } from '.'
import LauncherApp from '../app/LauncherApp'
import { HttpAgent, HttpsAgent } from '../util/agents'
// import getNatType, { NatType } from 'nat-type-identifier'

export default class NetworkManager extends Manager {
  private inGFW = false

  readonly agents: Required<Agents>

  private headers: Record<string, string> = {}

  readonly request: Got

  private upnp!: UpnpClient

  private stunHosts: string[] = []

  private activePeers: Socket[] = []

  private natInfo: undefined | NatInfo

  // private nat = new NatAPI()

  // private lanDiscover = new MinecraftLanDiscover()

  // private natType: NatType = 'Blocked'

  // private publicIp = ''

  // private discoveredPort: number[] = []

  constructor(app: LauncherApp) {
    super(app)
    const http = new HttpAgent({
      keepAlive: true,
      proxy: new URL('http://127.0.0.1:7890'),
    })
    Object.defineProperty(http, 'proxy', {
      get() {
        try {
          return new URL(app.serviceManager.getService(BaseServiceKey)!.state.httpProxy)
        } catch (e) {
          return undefined
        }
      },
    })
    Object.defineProperty(http, 'enabled', {
      get() {
        return app.serviceManager.getService(BaseServiceKey)?.state.httpProxyEnabled ?? false
      },
    })
    const https = new HttpsAgent({
      keepAlive: true,
      rejectUnauthorized: false,
      proxy: new URL('http://127.0.0.1:7890'),
    })
    Object.defineProperty(https, 'proxy', {
      get() {
        try {
          return new URL(app.serviceManager.getService(BaseServiceKey)!.state.httpProxy)
        } catch (e) {
          return undefined
        }
      },
    })
    Object.defineProperty(https, 'enabled', {
      get() {
        return app.serviceManager.getService(BaseServiceKey)?.state.httpProxyEnabled ?? false
      },
    })
    this.agents = ({
      http,
      https,
    })
    this.request = got.extend({ agent: this.agents })
  }

  getDownloadBaseOptions() {
    return {
      agents: this.agents,
      headers: this.headers,
    } as const
  }

  /**
   * Update the status of GFW
   */
  async updateGFW() {
    this.inGFW = await Promise.race([
      this.request.head('https://npm.taobao.org', { throwHttpErrors: false }).then(() => true, () => false),
      this.request.head('https://www.google.com', { throwHttpErrors: false }).then(() => false, () => true),
    ])
    this.log(this.inGFW ? 'Detected current in China mainland.' : 'Detected current NOT in China mainland.')
  }

  // async updateNatType() {
  //   this.log('Try to get NAT type')
  //   this.natType = await getNatType({ logsEnabled: false, stunHost: this.inGFW ? 'stun.qq.com' : undefined })
  //   this.log(`Update NAT type: ${this.natType}`)
  // }

  // async updatePublicIp() {
  //   this.log('Try update public ip')

  //   this.publicIp = await new Promise<string>((resolve, reject) => {
  //     this.nat.externalIp((err, ip) => {
  //       if (err) {
  //         reject(err)
  //       } else {
  //         resolve(ip)
  //       }
  //     })
  //   })

  //   this.log(`Current public ip is ${this.publicIp}`)
  // }

  // getNatType() {
  //   return this.natType
  // }

  /**
   * Return if current environment is in GFW.
   */
  get isInGFW() {
    return this.inGFW
  }

  // getPublicIp() {
  //   return new Promise<string>((resolve, reject) => {
  //     this.nat.externalIp((err, ip) => {
  //       if (err) { reject(err) } else { resolve(ip) }
  //     })
  //   })
  // }

  // exposePort(port: number) {
  //   return new Promise<void>((resolve, reject) => {
  //     this.nat.map(25565, port, (err) => {
  //       if (err) {
  //         reject(err)
  //       } else {
  //         resolve()
  //       }
  //     })
  //   })
  // }

  async getNatInfo() {
    const info = await Promise.all(this.stunHosts.map((s) => getNatInfoUDP({
      stun: s,
      retryInterval: 2000,
    })))

    this.log(info)

    return info
  }

  // setup code
  setup() {
    this.updateGFW()

    // this.updatePublicIp()

    // this.lanDiscover.bind()

    // this.lanDiscover.on('discover', (event) => {
    //   const idx = this.discoveredPort.indexOf(event.port)
    //   if (idx === -1) {
    //     this.discoveredPort.push(event.port)
    //     this.log(`Discover player is opening port: ${event.port} on lan! Exposing it to public network...`)
    //     this.exposePort(event.port).then(() => {
    //       this.log(`Success to map port ${event.port}. Use ${this.publicIp}:${event.port}`)
    //     }, (e) => {
    //       this.error(`Fail to map port ${event.port}.`)
    //       this.error(e)
    //     })
    //   }
    // })

    // createUpnpClient().then((client) => {
    //   this.upnp = client
    // })

    // @ts-ignore
    this.app.on('before-quit', () => {
      // this.nat.destroy()
    })
  }
}
