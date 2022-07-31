import LauncherApp from '../app/LauncherApp'
import { Inject } from '../util/objectRegistry'
import { AbstractService } from './Service'
import { UserService } from './UserService'
import { YggdrasilUserService } from './YggdrasilUserService'

export class LittleSkinUserService extends AbstractService {
  constructor(@Inject(LauncherApp) app: LauncherApp, @Inject(YggdrasilUserService) userService: YggdrasilUserService) {
    super(app, '')

    userService.registerThirdPartyApi('littleskin.cn', {
      hostName: 'https://littleskin.cn/api/yggdrasil',
      authenticate: '/authserver/authenticate',
      refresh: '/authserver/refresh',
      validate: '/authserver/validate',
      invalidate: '/authserver/invalidate',
      signout: '/authserver/signout',
    }, {
      // eslint-disable-next-line no-template-curly-in-string
      profile: 'https://littleskin.cn/api/yggdrasil/sessionserver/session/minecraft/profile/${uuid}',
      // eslint-disable-next-line no-template-curly-in-string
      profileByName: 'https://littleskin.cn/api/yggdrasil/users/profiles/minecraft/${name}',
      // eslint-disable-next-line no-template-curly-in-string
      texture: 'https://littleskin.cn/api/yggdrasil/user/profile/${uuid}/${type}',
    })
  }
}
