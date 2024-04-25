import { createSsdp, UpnpClient, UpnpMapOptions, UpnpUnmapOptions } from '@xmcl/nat-api'
import { NatService as INatService, MutableState, NatServiceKey, NatState, createPromiseSignal } from '@xmcl/runtime-api'
import { getNatInfoUDP, sampleNatType } from '@xmcl/stun-client'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, Inject } from '~/app'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { kIceServerProvider } from '~/iceServers'
@ExposeServiceKey(NatServiceKey)
export class NatService extends StatefulService<NatState> implements INatService {
  private client = createPromiseSignal<UpnpClient>()

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
  ) {
    super(app, () => store.registerStatic(new NatState(), NatServiceKey), async () => {
      this.refreshNatType().catch((e) => {
        this.warn('Failed to get nat type: %o', e)
      })

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
    this.client.promise.catch((e) => {
      this.warn(e)
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

    const p = await this.app.registry.get(kIceServerProvider)
    const servers = p.getIceServers(false)

    // randomly pick one
    const stun = servers[Math.floor(Math.random() * servers.length)]
    const info = await getNatInfoUDP({ stun })
    if (info.type !== 'Blocked') {
      this.state.natInfoSet(info.externalIp, info.externalPort)
    }
    this.state.natTypeSet(info.type)
    this.log('Fast nat detection: %o', info)

    const result = await sampleNatType({
      sampleCount: 3,
      retryInterval: 3_000,
      stun,
    })
    if (result) {
      this.state.natTypeSet(result)
    }
    this.log(`Refresh nat type ${result}`)
  }
}
