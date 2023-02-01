import { Pool } from 'undici'
import { YggdrasilAccountSystem } from '../accountSystems/YggdrasilAccountSystem'
import { LauncherAppPlugin } from '../app/LauncherApp'
import { YggdrasilThirdPartyClient } from '../clients/YggdrasilClient'
import { kUserTokenStorage } from '../entities/userTokenStore'
import { UserService } from '../services/UserService'

export const pluginElyAccountSystem: LauncherAppPlugin = (app) => {
  // const userService = app.serviceManager.get(UserService)
  // userService.initialize().then(() => {
  // const dispatcher = app.networkManager.registerAPIFactoryInterceptor((origin, options) => {
  //   if (origin.host === 'authserver.ely.by') {
  //     return new Pool(origin, {
  //       ...options,
  //       keepAliveMaxTimeout: 60_000,
  //       connections: 6,
  //       pipelining: 1,
  //     })
  //   }
  // })
  // const storage = app.registry.get(kUserTokenStorage)
  // if (storage) {
  //   const system = new YggdrasilAccountSystem(userService,
  //     new YggdrasilThirdPartyClient(
  //       // eslint-disable-next-line no-template-curly-in-string
  //       'https://authserver.ely.by/api/authlib-injector/sessionserver/session/minecraft/profile/${uuid}',
  //       // eslint-disable-next-line no-template-curly-in-string
  //       'https://authserver.ely.by/api/authlib-injector/api/user/profile/${uuid}/${type}',
  //       'https://authserver.ely.by/api/authlib-injector/authserver',
  //       () => userService.state.clientToken,
  //       dispatcher),
  //     storage,
  //   )
  //   userService.registerAccountSystem('ely.by', system)
  // }
  // })
}
