import { createSsdp, UpnpClient, UpnpMapOptions, UpnpUnmapOptions } from '@xmcl/nat-api'
import { createPromiseSignal, NatService as INatService, MutableState, NatServiceKey, NatState } from '@xmcl/runtime-api'
import { getNatInfoUDP, sampleNatType, UnblockedNatInfo } from '@xmcl/stun-client'
import { Inject, LauncherAppKey } from '~/app'
import { kIceServerProvider } from '~/iceServers'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
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
    const stuns = p.getIceServers().map(ice => ({ ip: ice.hostname, port: ice.port }))

    const winner = createPromiseSignal<{
      stun: {
        ip: string
        port: number
      }
      info: UnblockedNatInfo
    }>()
    const all = Promise.all(stuns.map(async (stun) => {
      const info = await getNatInfoUDP({ stun })
      if (info.type !== 'Blocked') {
        winner.resolve({ stun, info })
      }
    }))
    const winOrBlocked = await Promise.race([winner.promise, all])
    if (winOrBlocked instanceof Array) {
      // All blocked
      this.state.natTypeSet('Blocked')
    } else {
      const { stun, info } = winOrBlocked
      this.state.natInfoSet(info.externalIp, info.externalPort)
      this.state.natTypeSet(info.type)
      this.log('Fast nat detection: %o', info)
      p.setValidIceServers([{
        hostname: stun.ip,
        port: stun.port,
      }])

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
}
