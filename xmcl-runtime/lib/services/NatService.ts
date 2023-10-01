import { createSsdp, UpnpClient, UpnpMapOptions, UpnpUnmapOptions } from '@xmcl/nat-api'
import { NatService as INatService, MutableState, NatServiceKey, NatState } from '@xmcl/runtime-api'
import { getNatInfoUDP, sampleNatType } from '@xmcl/stun-client'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { createPromiseSignal } from '../util/promiseSignal'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'
@ExposeServiceKey(NatServiceKey)
export class NatService extends StatefulService<NatState> implements INatService {
  private client = createPromiseSignal<UpnpClient>()

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, () => new NatState(), async () => {
      this.refreshNatType()

      try {
        const ssdp = await createSsdp()
        const client = new UpnpClient(ssdp)
        const { device, address } = await client.findGateway()
        const info = await device.connectDevice()
        this.client.resolve(client)
        this.state.natDeviceSet(info)
        this.state.natAddressSet(address.address)
      } catch (e) {
        this.client.reject(e)
      }
    })
  }

  async getNatState(): Promise<MutableState<NatState>> {
    await this.initialize()
    return this.state
  }

  async isSupported(): Promise<boolean> {
    return this.client.promise.then(() => true, () => false)
  }

  async getMappings() {
    try {
      const client = await this.client.promise
      return client.getMappings()
    } catch (e) {
      if (e instanceof Error) this.error(e)
      return []
    }
  }

  async map(options: UpnpMapOptions) {
    const client = await this.client.promise
    await client.map(options)
  }

  async unmap(options: UpnpUnmapOptions) {
    const client = await this.client.promise
    return await client.unmap(options)
  }

  @Singleton()
  async refreshNatType(): Promise<void> {
    this.log('Start to sample the nat type')

    const info = await getNatInfoUDP({ stun: 'stun.qq.com' })
    if (info.type !== 'Blocked') {
      this.state.natInfoSet(info.externalIp, info.externalPort)
    }
    this.state.natTypeSet(info.type)
    this.log('Fast nat detection: %o', info)

    const result = await sampleNatType({
      sampleCount: 3,
      retryInterval: 3_000,
      stun: 'stun.qq.com',
    })
    if (result) {
      this.state.natTypeSet(result)
    }
    this.log(`Refresh nat type ${result}`)
  }
}
