import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { AbstractService } from './Service'
import { UserService } from './UserService'
import { YggdrasilUserService } from './YggdrasilUserService'

export class ElyByUserService extends AbstractService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp, @Inject(UserService) userService: UserService, @Inject(YggdrasilUserService) yggService: YggdrasilUserService) {
    super(app, '')

    const authService = {
      hostName: 'https://authserver.ely.by',
      authenticate: '/auth/authenticate',
      refresh: '/auth/refresh',
      validate: '/auth/validate',
      invalidate: '/auth/invalidate',
      signout: '/auth/signout',
    }
    const profileService = {
      // eslint-disable-next-line no-template-curly-in-string
      profile: 'https://authserver.ely.by/session/profile/${uuid}',
      // eslint-disable-next-line no-template-curly-in-string
      profileByName: 'https://skinsystem.ely.by/textures/${name}',
      // eslint-disable-next-line no-template-curly-in-string
      texture: 'https://authserver.ely.by/session/profile/${uuid}/${type}',
    }
    userService.registerAccountSystem({
      name: 'ely.by',
      login: (u, p, a) => yggService.login_({ username: u, password: p }, a, authService),
      refresh: (p, c) => yggService.refresh(p, c, authService),
      getSkin: (p) => yggService.getSkin(p, profileService),
      setSkin: (p, g, s, slim) => yggService.setSkin(p, g, s, slim, profileService),
    })
  }
}
