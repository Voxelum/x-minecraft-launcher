import { Client, getGlobalDispatcher, Pool } from 'undici'
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

    const dispatcher = this.networkManager.registerAPIFactoryInterceptor((origin, options) => {
      if (origin.host === 'authserver.ely.by') {
        return new Pool(origin, {
          ...options,
          keepAliveMaxTimeout: 60_000,
          connections: 6,
          pipelining: 1,
        })
      }
    })

    const system = new YggdrasilAccountSystem(this,
      new YggdrasilThirdPartyClient(
      // eslint-disable-next-line no-template-curly-in-string
        'https://authserver.ely.by/api/authlib-injector/sessionserver/session/minecraft/profile/${uuid}',
        // eslint-disable-next-line no-template-curly-in-string
        'https://authserver.ely.by/api/authlib-injector/api/user/profile/${uuid}/${type}',
        'https://authserver.ely.by/api/authlib-injector/authserver',
        () => userService.state.clientToken,
        dispatcher),
    )
    userService.registerAccountSystem('ely.by', system)
  }
}
