/* eslint-disable camelcase */
import LauncherApp from '../app/LauncherApp'
import { Inject } from '../util/objectRegistry'
import { AbstractService, ExposeServiceKey } from './Service'
import { UserService } from './UserService'
import { YggdrasilUserService } from './YggdrasilUserService'
import { AddClosetOptions, Character, ClosetResponse, GetClosetOptions, ListSkinResult, LittleSkinUserService as ILittleSkinUserService, LittleSkinUserServiceKey, RenameClosetOptions, SetCharacterNameOptions, SetCharacterTextureOptions, UploadSkinOptions, UploadSkinResult, UserProfile } from '@xmcl/runtime-api'
import { LauncherAppKey } from '../app/utils'
import { Got } from 'got'

@ExposeServiceKey(LittleSkinUserServiceKey)
export class LittleSkinUserService extends AbstractService implements ILittleSkinUserService {
  private client: Got

  constructor(@Inject(LauncherAppKey) app: LauncherApp, @Inject(UserService) private userService: UserService, @Inject(YggdrasilUserService) yggService: YggdrasilUserService) {
    super(app, LittleSkinUserServiceKey)
    const authService = {
      hostName: 'https://littleskin.cn/api/yggdrasil',
      authenticate: '/authserver/authenticate',
      refresh: '/authserver/refresh',
      validate: '/authserver/validate',
      invalidate: '/authserver/invalidate',
      signout: '/authserver/signout',
    }
    const profileService = {
      // eslint-disable-next-line no-template-curly-in-string
      profile: 'https://littleskin.cn/api/yggdrasil/sessionserver/session/minecraft/profile/${uuid}',
      // eslint-disable-next-line no-template-curly-in-string
      profileByName: 'https://littleskin.cn/api/yggdrasil/users/profiles/minecraft/${name}',
      // eslint-disable-next-line no-template-curly-in-string
      texture: 'https://littleskin.cn/api/yggdrasil/user/profile/${uuid}/${type}',
    }
    userService.registerAccountSystem({
      name: 'littleskin.cn',
      login: async (u, p, a) => {
        const result: UserProfile = await yggService.login_({ username: u, password: p }, a, authService)

        try {
          const { token } = await this.client.post('/api/auth/login', {
            searchParams: {
              email: u,
              password: p,
            },
          }).json()

          if (token) {
            result.siteToken = token
          }
        } catch {
        }

        return result
      },
      refresh: async (p, c) => {
        const result: UserProfile = await yggService.refresh(p, c, authService)
        try {
          const { token } = await this.client.post('/api/auth/refresh', {
            headers: {
              Authorization: `Bearer ${result.siteToken}`,
            },
          }).json()

          if (token) {
            result.siteToken = token
          }
        } catch {
        }
        return result
      },
      getSkin: (p) => yggService.getSkin(p, profileService),
      setSkin: (p, g, s, slim) => yggService.setSkin(p, g, s, slim, profileService),
    })

    this.client = this.networkManager.request.extend({
      prefixUrl: 'https://littleskin.cn',
    })
  }

  uploadSkin(options: UploadSkinOptions): Promise<UploadSkinResult> {
    throw new Error('Method not implemented.')
  }

  async getAllCharacters(): Promise<Character[]> {
    const user = this.userService.state.user
    if (user?.authService !== 'littleskin.cn') {
      throw new Error()
    }
    const result: Character[] = await this.client('/api/closet', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${user.siteToken}`,
      },
    }).json()
    return result
  }

  async setCharacterName(options: SetCharacterNameOptions): Promise<void> {
    const user = this.userService.state.user
    if (user?.authService !== 'littleskin.cn') {
      throw new Error()
    }
    await this.client(`/api/players/${options.pid}/name`, {
      method: 'PUT',
      searchParams: {
        name: options.name,
      },
      headers: {
        Authorization: `Bearer ${user.siteToken}`,
      },
    }).json()
  }

  async setCharacterTexture(options: SetCharacterTextureOptions): Promise<void> {
    const user = this.userService.state.user
    if (user?.authService !== 'littleskin.cn') {
      throw new Error()
    }
    await this.client(`/api/players/${options.pid}/textures`, {
      method: 'PUT',
      searchParams: {
        skin: options.skin,
        cape: options.cape,
      },
      headers: {
        Authorization: `Bearer ${user.siteToken}`,
      },
    }).json()
  }

  async addCloset(options: AddClosetOptions) {
    const user = this.userService.state.user
    if (user?.authService !== 'littleskin.cn') {
      throw new Error()
    }
    await this.client('/api/closet', {
      method: 'POST',
      searchParams: {
        tid: options.tid,
        name: options.name,
      },
      headers: {
        Authorization: `Bearer ${user.siteToken}`,
      },
    }).json()
  }

  async renameCloset(options: RenameClosetOptions) {
    const user = this.userService.state.user
    if (user?.authService !== 'littleskin.cn') {
      throw new Error()
    }
    await this.client(`/api/closet/${options.tid}`, {
      method: 'PUT',
      searchParams: {
        name: options.name,
      },
      headers: {
        Authorization: `Bearer ${user.siteToken}`,
      },
    }).json()
  }

  async deleteClose(tid: number) {
    const user = this.userService.state.user
    if (user?.authService !== 'littleskin.cn') {
      throw new Error()
    }
    await this.client(`/api/closet/${tid}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${user.siteToken}`,
      },
    }).json()
  }

  async getCloset(options: GetClosetOptions) {
    const user = this.userService.state.user
    if (user?.authService !== 'littleskin.cn') {
      throw new Error()
    }
    const response: ClosetResponse = await this.client('/api/closet', {
      method: 'GET',
      searchParams: {
        page: options.page,
        category: options.category,
      },
      headers: {
        Authorization: `Bearer ${user.siteToken}`,
      },
    }).json()
    return response
  }

  async listSkins(): Promise<ListSkinResult> {
    // https://littleskin.cn/skinlib/list
    const result = await this.client.get('skinlib/list').json()
    return result as ListSkinResult
  }
}
