/* eslint-disable camelcase */
import { AddClosetOptions, GetClosetOptions, LittleSkinUserService as ILittleSkinUserService, ListSkinResult, LittleSkinCharacter, LittleSkinUserServiceKey, RenameClosetOptions, SetCharacterNameOptions, SetCharacterTextureOptions, UploadTextureOptions, UploadTextureResult } from '@xmcl/runtime-api'
import { FormData, Pool, request } from 'undici'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { LittleSkinClient } from '../clients/LittleSkinClient'
import { UserTokenStorage, kUserTokenStorage } from '../entities/userTokenStore'
import { Inject } from '../util/objectRegistry'
import { BaseService } from './BaseService'
import { AbstractService, ExposeServiceKey } from './Service'
import { UserService } from './UserService'
import { kNetworkInterface, NetworkInterface } from '../entities/networkInterface'

const LITTLE_SKIN_HOST = 'littleskin.cn'

@ExposeServiceKey(LittleSkinUserServiceKey)
export class LittleSkinUserService extends AbstractService implements ILittleSkinUserService {
  private client: LittleSkinClient

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(UserService) private userService: UserService,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(kNetworkInterface) networkInterface: NetworkInterface,
    ) {
    super(app)

    const dispatcher = networkInterface.registerAPIFactoryInterceptor((origin, options) => {
      if (origin.hostname === LITTLE_SKIN_HOST) {
        return new Pool(origin, {
          ...options,
          pipelining: 1,
          connections: 6,
          keepAliveMaxTimeout: 60_000,
        })
      }
    })
    this.client = new LittleSkinClient(dispatcher)

    // const ygg = new YggdrasilAccountSystem(
    //   this,
    // new YggdrasilThirdPartyClient(
    //   // eslint-disable-next-line no-template-curly-in-string
    //   'https://littleskin.cn/api/yggdrasil/sessionserver/session/minecraft/profile/${uuid}',
    //   // eslint-disable-next-line no-template-curly-in-string
    //   'https://littleskin.cn/api/yggdrasil/api/user/profile/${uuid}/${type}',
    //   'https://littleskin.cn/api/yggdrasil/authserver',
    //   () => userService.getClientToken(),
    //   dispatcher,
    // ),
    //   dispatcher,
    //   userService.state,
    //   tokenCache,
    // )

    // userService.registerAccountSystem(LITTLE_SKIN_HOST, {
    //   getYggdrasilHost() {
    //     return 'https://littleskin.cn/api/yggdrasil/authserver'
    //   },
    //   login: ygg.login.bind(ygg),
    //   refresh: ygg.refresh.bind(ygg),
    //   setSkin: ygg.setSkin.bind(ygg),
    // })
  }

  async authenticate(): Promise<void> {
    const url = 'https://littleskin.cn/oauth/authorize?client_id=393&redirect_uri=http://localhost:25555/littleskin&response_type=code&scope'
    this.emit('authorize-url', url)
    await this.app.shell.openInBrowser(url)
    const code = await new Promise<string>((resolve, reject) => {
      const abort = () => {
        reject(new Error('Timeout to wait the auth code! Please try again later!'))
      }
      // (signal as any)?.addEventListener('abort', abort)
      this.once('authorize-code', (err, code) => {
        if (err) {
          reject(err)
        } else {
          resolve(code!)
        }
      })
    })
    const body = new FormData()
    body.append('grant_type', 'authorization_code')
    body.append('client_id', '393')
    body.append('client_secret', 'pGmFutnvu1H3eHfqJC8l80CYcCtjk3p4ykZaUzJW')
    body.append('redirect_uri', 'http://localhost:25555/littleskin')
    body.append('code', code)
    const response = await request('https://littleskin.cn/oauth/authorize', {
      method: 'POST',
      body,
    })
    const responseBody = await response.body.json()
    throw new Error('Method not implemented.')
  }

  uploadTexture(options: UploadTextureOptions): Promise<UploadTextureResult> {
    throw new Error('Method not implemented.')
  }

  async getAllCharacters(): Promise<LittleSkinCharacter[]> {
    // const user = this.userService.state.user
    // if (user?.authService !== LITTLE_SKIN_HOST || !user) {
    //   throw new Error()
    // }
    // const token = await this.cache.getToken(LITTLE_SKIN_HOST, user.username)
    // if (!token) {
    throw new Error()
    // }
    // return await this.client.getAllCharacters(token)
  }

  async setCharacterName(options: SetCharacterNameOptions): Promise<void> {
    // const user = this.userService.state.user
    // if (user?.authService !== LITTLE_SKIN_HOST || !user) {
    //   throw new Error()
    // }
    // const token = await this.cache.getToken(LITTLE_SKIN_HOST, user.username)
    // if (!token) {
    throw new Error()
    // }
    // await this.client.setCharacterName(options, token)
  }

  async setCharacterTexture(options: SetCharacterTextureOptions): Promise<void> {
    // const user = this.userService.state.user
    // if (user?.authService !== LITTLE_SKIN_HOST || !user) {
    //   throw new Error()
    // }
    // const token = await this.cache.getToken(LITTLE_SKIN_HOST, user.username)
    // if (!token) {
    throw new Error()
    // }
    // await this.client.setCharacterTexture(options, token)
  }

  async addCloset(options: AddClosetOptions) {
    // const user = this.userService.state.user
    // if (user?.authService !== LITTLE_SKIN_HOST || !user) {
    //   throw new Error()
    // }
    // const token = await this.cache.getToken(LITTLE_SKIN_HOST, user.username)
    // if (!token) {
    throw new Error()
    // }
    // await this.client.addCloset(options, token)
  }

  async renameCloset(options: RenameClosetOptions) {
    // const user = this.userService.state.user
    // if (user?.authService !== LITTLE_SKIN_HOST || !user) {
    throw new Error()
    // }
    // const token = await this.cache.getToken(LITTLE_SKIN_HOST, user.username)
    // if (!token) {
    //   throw new Error()
    // }
    // await this.client.renameCloset(options, token)
  }

  async deleteCloset(tid: number) {
    // const user = this.userService.state.user
    // if (user?.authService !== LITTLE_SKIN_HOST || !user) {
    throw new Error()
    // }
    // const token = await this.cache.getToken(LITTLE_SKIN_HOST, user.username)
    // if (!token) {
    //   throw new Error()
    // }
    // await this.client.deleteCloset(tid, token)
  }

  async getCloset(options: GetClosetOptions) {
    // const user = this.userService.state.user
    // if (user?.authService !== LITTLE_SKIN_HOST || !user) {
    //   throw new Error()
    // }
    // const token = await this.cache.getToken(LITTLE_SKIN_HOST, user.username)
    // if (!token) {
    throw new Error()
    // }
    // return await this.client.getCloset(options, token)
  }

  async listSkins(): Promise<ListSkinResult> {
    const result = await this.client.listSkins()
    return result as ListSkinResult
  }
}
