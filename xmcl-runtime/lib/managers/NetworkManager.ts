import LauncherApp from '../app/LauncherApp'
import { Agents, DownloadBaseOptions } from '@xmcl/installer'
import got from 'got'
import { Agent as HttpAgent } from 'http'
// import NatAPI from 'nat-api'
import { Agent as HttpsAgent, AgentOptions } from 'https'
import { cpus } from 'os'
import { Manager } from '.'
// import { MinecraftLanDiscover } from '@xmcl/client'
// import getNatType, { NatType } from 'nat-type-identifier'

export default class NetworkManager extends Manager {
  private inGFW = false

  private agents: Agents

  private headers: Record<string, string> = {}

  readonly request = got.extend({})

  // private nat = new NatAPI()

  // private lanDiscover = new MinecraftLanDiscover()

  // private natType: NatType = 'Blocked'

  // private publicIp = ''

  // private discoveredPort: number[] = []

  constructor(app: LauncherApp) {
    super(app)
    const options: AgentOptions = {
      keepAlive: true,
      maxSockets: cpus().length * 4,
      rejectUnauthorized: false,
    }
    this.agents = ({
      http: new HttpAgent(options),
      https: new HttpsAgent(options),
    })
  }

  getDownloadBaseOptions(): DownloadBaseOptions {
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

  // setup code
  setup() {
    // this.updateGFW().then(() => this.updateNatType())

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

    // @ts-ignore
    this.app.on('before-quit', () => {
      // this.nat.destroy()
    })
  }
}
