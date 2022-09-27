// import NatAPI from 'nat-api'
import { getNatInfoUDP, NatInfo } from '@xmcl/stun-client'
import { UpnpClient } from '@xmcl/nat-api'
// import getNatType, { NatType } from 'nat-type-identifier'

export class NatService {
  // private nat = new NatAPI()
  
  // private upnp!: UpnpClient

  // private stunHosts: string[] = []

  // private natInfo: undefined | NatInfo

  // private natType: NatType = 'Blocked'

  // private publicIp = ''

  // private discoveredPort: number[] = []

  // async updateNatType() {
  //   // this.log('Try to get NAT type')
  //   this.natType = await getNatType({ logsEnabled: false, stunHost: this.inGFW ? 'stun.qq.com' : undefined })
  //   // this.log(`Update NAT type: ${this.natType}`)
  // }

  // async updatePublicIp() {
  //   // this.log('Try update public ip')

  //   this.publicIp = await new Promise<string>((resolve, reject) => {
  //     this.nat.externalIp((err, ip) => {
  //       if (err) {
  //         reject(err)
  //       } else {
  //         resolve(ip)
  //       }
  //     })
  //   })

  //   // this.log(`Current public ip is ${this.publicIp}`)
  // }

  // getNatType() {
  //   return this.natType
  // }

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

  // async getNatInfo() {
  //   const info = await Promise.all(this.stunHosts.map((s) => getNatInfoUDP({
  //     stun: s,
  //     retryInterval: 2000,
  //   })))

  //   this.logger.log(info)

  //   return info
  // }
}
