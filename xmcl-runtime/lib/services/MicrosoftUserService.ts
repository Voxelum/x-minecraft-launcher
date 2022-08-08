/* eslint-disable quotes */
import { LogLevel, PublicClientApplication } from '@azure/msal-node'
import { GameProfileAndTexture, LoginMicrosoftOptions, MicrosoftUserService as IMicrosoftUserService, MicrosoftUserServiceKey, UserException } from '@xmcl/runtime-api'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { CLIENT_ID } from '../constant'
import { acquireXBoxToken, changeAccountSkin, checkGameOwnership, getGameProfile, loginMinecraftWithXBox } from '../entities/user'
import { createPlugin } from '../util/credentialPlugin'
import { toRecord } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { BaseService } from './BaseService'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'
import { UserService } from './UserService'
import { request } from 'undici'

@ExposeServiceKey(MicrosoftUserServiceKey)
export class MicrosoftUserService extends AbstractService implements IMicrosoftUserService {
  readonly scopes: string[] = ['XboxLive.signin', 'XboxLive.offline_access']
  readonly extraScopes: string[] = ['user.email', 'user.openid', 'user.offline_access']
  private cancelWait = () => { }

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) private baseService: BaseService,
    @Inject(UserService) private userService: UserService) {
    super(app, MicrosoftUserServiceKey)

    userService.registerAccountSystem({
      name: 'microsoft',
      login: async () => {
        throw new Error('Not implemented')
      },
      refresh: async (user) => {
        const diff = Date.now() - user.expiredAt
        if (!user.expiredAt || user.expiredAt < Date.now() || (diff / 1000 / 3600 / 24) > 14) {
          // expired
          this.log(`Microsoft accessToken expired. Refresh a new one.`)
          const { accessToken, expiredAt, gameProfiles, selectedProfile } = await this.login({ microsoftEmailAddress: user.username })

          user.accessToken = accessToken
          user.expiredAt = expiredAt
          user.selectedProfile = selectedProfile?.id ?? ''
          user.profiles = toRecord(gameProfiles, v => v.id)

          return user
        }

        return user
      },
      getSkin: async (user) => {
        const profile = await getGameProfile(this.networkManager.request, user.accessToken)

        user.profiles[profile.id] = {
          ...profile,
          textures: {
            SKIN: {
              url: profile.skins[0].url,
              metadata: { model: profile.skins[0].variant === 'CLASSIC' ? 'steve' : 'slim' },
            },
            CAPE: profile.capes.length > 0
              ? {
                url: profile.capes[0].url,
              }
              : undefined,
          },
        }
        return user
      },
      setSkin: async (user, gameProfile, skin, slim) => {
        const profile = await changeAccountSkin(this.app.networkManager.request, user.accessToken,
          typeof skin === 'string' ? skin : 'skin.png',
          skin,
          slim ? 'slim' : 'classic',
        )
        user.profiles[gameProfile.id] = {
          ...gameProfile,
          ...profile,
          textures: {
            SKIN: {
              url: profile.skins[0].url,
              metadata: { model: profile.skins[0].variant === 'CLASSIC' ? 'steve' : 'slim' },
            },
            CAPE: profile.capes.length > 0
              ? {
                url: profile.capes[0].url,
              }
              : undefined,
          },
        }
        return user
      },
    })
  }

  protected async getOAuthApp(account: string) {
    return new PublicClientApplication({
      auth: {
        authority: 'https://login.microsoftonline.com/consumers/',
        clientId: CLIENT_ID,
      },
      cache: {
        cachePlugin: createPlugin('xmcl', account),
      },
      system: {
        loggerOptions: {
          logLevel: LogLevel.Verbose,
          loggerCallback: (level, message, ppi) => {
            this.log(`${message}`)
          },
        },
      },
    })
  }

  cancelMicrosoftTokenRequest() {
    this.cancelWait()
  }

  async changeName(name: string) {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    request(`https://api.minecraftservices.com/minecraft/profile/name/${name}`, {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
    })
    await this.networkManager.request.put(`https://api.minecraftservices.com/minecraft/profile/name/${name}`, {
      headers: {
        Authorization: `Bearer ${user.accessToken}`,
      },
      throwHttpErrors: false,
    }).json()
  }

  protected async acquireMicrosoftToken({ username, code, directRedirectToLauncher, getPort }: { username: string; code?: string; directRedirectToLauncher?: boolean; getPort?: () => Promise<number> }) {
    const app = await this.getOAuthApp(username)
    if (username && !code) {
      const accounts = await app.getTokenCache().getAllAccounts().catch(() => [])
      const account = accounts.find(a => a.username === username)
      if (account) {
        const result = await app.acquireTokenSilent({
          scopes: this.scopes,
          account,
          forceRefresh: false,
        }).catch((e) => {
          this.warn(`Fail to acquire microsoft token silently for ${username}`)
          this.warn(e)
          return null
        })
        const userRead = await app.acquireTokenSilent({
          scopes: this.extraScopes,
          account,
        }).catch((e) => {
          this.warn(`Fail to acquire microsoft token silently for ${username}`)
          this.warn(e)
          return null
        })
        if (result) {
          return {
            xbox: result,
            microsoft: userRead,
          }
        }
      }
    }
    const scopes = this.scopes
    const redirectUri = (directRedirectToLauncher ? 'http://localhost:25555/auth' : 'https://xmcl.app/auth') + `?port=${await getPort?.() ?? 25555}`

    if (!code) {
      const url = await app.getAuthCodeUrl({
        redirectUri,
        scopes,
        extraScopesToConsent: this.extraScopes,
        loginHint: username,
      })
      this.baseService.openInBrowser(url)
      this.userService.emit('microsoft-authorize-url', url)
      code = await new Promise<string>((resolve, reject) => {
        this.cancelWait = () => {
          reject(new Error('Timeout to wait the auth code! Please try again later!'))
        }
        this.userService.once('microsoft-authorize-code', (err, code) => {
          if (err) {
            reject(err)
          } else {
            resolve(code!)
          }
        })
      }).finally(() => {
        this.cancelWait = () => { }
      })
    }

    const result = await app.acquireTokenByCode({ code, scopes, redirectUri })
    const msResult = await app.acquireTokenSilent({
      account: result!.account!,
      scopes: this.extraScopes,
    })
    return {
      xbox: result,
      microsoft: msResult,
    }
  }

  async cancelLogin(): Promise<void> {
    this.cancelWait()
  }

  @Singleton()
  async login(options: LoginMicrosoftOptions) {
    const { oauthCode, microsoftEmailAddress } = options

    const req = this.app.networkManager.request
    const { microsoft: msToken, xbox: xboxToken } = await this.acquireMicrosoftToken({ username: microsoftEmailAddress, code: oauthCode })
      .catch((e) => {
        this.error(e)
        throw new UserException({ type: 'userAcquireMicrosoftTokenFailed', error: e.toString() })
      })

    this.log('Successfully get Microsoft access token')
    const oauthAccessToken = xboxToken!.accessToken
    const { xstsResponse, xboxGameProfile } = await acquireXBoxToken(req, oauthAccessToken).catch((e) => {
      this.error(e)
      throw new UserException({ type: 'userExchangeXboxTokenFailed', error: e.toString() })
    })
    this.log('Successfully login Xbox')

    const mcResponse = await loginMinecraftWithXBox(req, xstsResponse.DisplayClaims.xui[0].uhs, xstsResponse.Token).catch((e) => {
      this.error(e)
      throw new UserException({ type: 'userLoginMinecraftByXboxFailed', error: e.toString() })
    })
    this.log('Successfully login Minecraft with Xbox')

    const ownershipResponse = await checkGameOwnership(req, mcResponse.access_token).catch((e) => {
      this.error(e)
      throw new UserException({ type: 'userCheckGameOwnershipFailed', error: e.toString() })
    })
    const ownGame = ownershipResponse.items.length > 0
    this.log(`Successfully check ownership: ${ownGame}`)

    if (ownGame) {
      const gameProfileResponse = await getGameProfile(req, mcResponse.access_token)
      this.log('Successfully get game profile')
      const gameProfiles: GameProfileAndTexture[] = [{
        id: gameProfileResponse.id,
        name: gameProfileResponse.name,
        textures: {
          SKIN: {
            url: gameProfileResponse.skins[0].url,
            metadata: { model: gameProfileResponse.skins[0].variant === 'CLASSIC' ? 'steve' : 'slim' },
          },
          CAPE: gameProfileResponse.capes.length > 0
            ? {
              url: gameProfileResponse.capes[0].url,
            }
            : undefined,
        },
      }]
      return {
        userId: mcResponse.username,
        accessToken: mcResponse.access_token,
        gameProfiles,
        msAccessToken: msToken?.accessToken,
        selectedProfile: gameProfiles[0],
        avatar: xboxGameProfile.profileUsers[0].settings.find(v => v.id === 'PublicGamerpic')?.value,
        expiredAt: mcResponse.expires_in * 1000 + Date.now(),
      }
    }

    return {
      userId: mcResponse.username,
      accessToken: mcResponse.access_token,
      gameProfiles: [],
      msAccessToken: msToken?.accessToken,
      selectedProfile: undefined,
      avatar: xboxGameProfile.profileUsers[0].settings.find(v => v.id === 'PublicGamerpic')?.value,
      expiredAt: mcResponse.expires_in * 1000 + Date.now(),
    }
  }
}
