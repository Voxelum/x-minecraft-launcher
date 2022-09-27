import { getGlobalDispatcher } from 'undici'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { AbstractService, ExposeServiceKey } from './Service'
import { UserService } from './UserService'

import { ElyByService as IElyByService, ElyByServiceKey } from '@xmcl/runtime-api'
import { YggdrasilAccountSystem } from '../accountSystems/YggdrasilAccountSystem'
import { YggdrasilThirdPartyClient } from '../clients/YggdrasilClient'

@ExposeServiceKey(ElyByServiceKey)
export class ElyByService extends AbstractService implements IElyByService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(UserService) userService: UserService) {
    super(app, ElyByServiceKey)

    const system = new YggdrasilAccountSystem(this,
      new YggdrasilThirdPartyClient('https://authserver.ely.by/auth',
      // eslint-disable-next-line no-template-curly-in-string
        'https://authserver.ely.by/session/profile/${uuid}',
        // eslint-disable-next-line no-template-curly-in-string
        'https://authserver.ely.by/session/profile/${uuid}/${type}',
        () => userService.state.clientToken,
        getGlobalDispatcher()),
    )
    userService.registerAccountSystem('ely.by', system)
  }
}
