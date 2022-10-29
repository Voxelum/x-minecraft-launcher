import { NatService as INatService, NatServiceKey, NatState } from '@xmcl/runtime-api'
import { getNatInfoUDP, sampleNatType } from '@xmcl/stun-client'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { ExposeServiceKey, AbstractService, StatefulService, Singleton } from './Service'
@ExposeServiceKey(NatServiceKey)
export class NatService extends StatefulService<NatState> implements INatService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, () => new NatState(), async () => {
      await this.refreshNatType()
    })
  }

  @Singleton()
  async refreshNatType(): Promise<void> {
    this.log('Start to sample the nat type')

    const info = await getNatInfoUDP()
    if (info.type !== 'Blocked') {
      this.state.natInfoSet(info.externalIp, info.externalPort)
    }
    this.state.natTypeSet(info.type)
    this.log('Fast nat detection: %o', info)

    const result = await sampleNatType({
      sampleCount: 3,
      retryInterval: 3_000,
    })
    if (result) {
      this.state.natTypeSet(result)
    }
    this.log(`Refresh nat type ${result}`)
  }
}
