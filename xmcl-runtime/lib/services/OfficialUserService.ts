import { OfficialUserService as IOfficialUserService, OfficialUserServiceKey, UserException, UserProfile } from '@xmcl/runtime-api'
import { MojangChallengeResponse } from '@xmcl/user'
import { Client } from 'undici'
import { MicrosoftAccountSystem } from '../accountSystems/MicrosoftAccountSystem'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { MicrosoftAuthenticator } from '../clients/MicrosoftAuthenticator'
import { MicrosoftOAuthClient } from '../clients/MicrosoftOAuthClient'
import { MojangClient } from '../clients/MojangClient'
import { YggdrasilClient } from '../clients/YggdrasilClient'
import { CLIENT_ID, IS_DEV } from '../constant'
import { normalizeGameProfile } from '../entities/user'
import { isSystemError } from '../util/error'
import { toRecord } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { BaseService } from './BaseService'
import { AbstractService, ExposeServiceKey } from './Service'
import { UserService } from './UserService'

@ExposeServiceKey(OfficialUserServiceKey)
export class OfficialUserService extends AbstractService implements IOfficialUserService {
  private mojangApi: MojangClient

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(BaseService) baseService: BaseService,
    @Inject(UserService) private userService: UserService) {
    super(app)

    const dispatcher = this.networkManager.registerAPIFactoryInterceptor((origin, opts) => {
      if (origin.hostname === 'api.minecraftservices.com' || origin.hostname === 'api.mojang.com') {
        // keep alive for a long time
        return new Client(origin, { ...opts, pipelining: 6 })
      }
      if (origin.hostname === 'login.microsoftonline.com' || origin.hostname === 'user.auth.xboxlive.com' || origin.hostname === 'xsts.auth.xboxlive.com' || origin.hostname === 'profile.xboxlive.com' || origin.hostname === 'authserver.mojang.com' || origin.hostname === 'textures.minecraft.net') {
        // short connection for authenticate connection
        return new Client(origin, { ...opts, pipelining: 6, keepAliveMaxTimeout: 10e3 })
      }
    })

    this.mojangApi = new MojangClient(dispatcher)

    const system = new MicrosoftAccountSystem(this,
      new MicrosoftAuthenticator(dispatcher),
      this.mojangApi,
      new MicrosoftOAuthClient(this,
        CLIENT_ID,
        async (url, signal) => {
          baseService.openInBrowser(url)
          this.emit('microsoft-authorize-url', url)
          return await new Promise<string>((resolve, reject) => {
            const abort = () => {
              reject(new Error('Timeout to wait the auth code! Please try again later!'))
            }
            (signal as any)?.addEventListener('abort', abort)
            this.once('microsoft-authorize-code', (err, code) => {
              if (err) {
                reject(err)
              } else {
                resolve(code!)
              }
            })
          })
        },
        async (directRedirectToLauncher) => {
          if (IS_DEV) directRedirectToLauncher = true
          const port = await app.localhostServerPort.promise ?? 25555
          return (directRedirectToLauncher ? `http://localhost:${port}/auth` : `https://xmcl.app/auth?port=${port}`)
        },
        (response) => {
          this.emit('device-code', response)
          baseService.openInBrowser(response.verificationUri)
        },
        dispatcher,
      ))

    userService.registerAccountSystem('microsoft', system)

    const legacyClient = new YggdrasilClient('https://authserver.mojang.com', () => userService.state.clientToken, dispatcher)
    userService.registerAccountSystem('mojang', {
      login: async (options) => {
        const result = await legacyClient.login({ username: options.username, password: options.password ?? '', requestUser: true })
          .catch((e) => {
            if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
              throw new UserException({ type: 'loginInternetNotConnected' }, e.message)
            } else if (e.error === 'ForbiddenOperationException' &&
            e.errorMessage === 'Invalid credentials. Invalid username or password.') {
              throw new UserException({ type: 'loginInvalidCredentials' }, e.message)
            } else if (e.error === 'ForbiddenOperationException' &&
            e.errorMessage === 'Invalid credential information.') {
              throw new UserException({ type: 'loginInvalidCredentials' }, e.message)
            } else if (isSystemError(e)) {
              if (e.code === 'ETIMEDOUT') {
                throw new UserException({ type: 'loginTimeout' }, e.message)
              } else if (e.code === 'ECONNRESET') {
                throw new UserException({ type: 'loginReset' }, e.message)
              }
            }
            throw new UserException({ type: 'loginGeneral' }, e.message)
          })

        const userProfile: UserProfile = {
          id: result.user!.id,
          accessToken: result.accessToken,
          username: options.username,
          profiles: toRecord(result.availableProfiles.map(normalizeGameProfile), (v) => v.id),
          selectedProfile: result.selectedProfile?.id ?? '',
          expiredAt: Date.now() + 86400_000,
          authService: options.service,
        }

        return userProfile
      },
      refresh: async (user) => {
        const valid = await legacyClient.validate(user.accessToken)

        this.log(`Validate ${user.authService} user access token: ${valid ? 'valid' : 'invalid'}`)

        if (valid) {
          return user
        }
        try {
          const result = await legacyClient.refresh({
            accessToken: user.accessToken,
            requestUser: true,
          })
          this.log(`Refreshed user access token for user: ${user.id}`)

          user.accessToken = result.accessToken
          user.expiredAt = Date.now() + 86400_000
        } catch (e) {
          this.error(e)
          this.warn(`Invalid current user ${user.id} accessToken!`)
        }
        return user
      },
      setSkin: system.setSkin.bind(system),
    })

    app.registerUrlHandler((url) => {
      const parsed = new URL(url, 'xmcl://launcher')
      if (parsed.host === 'launcher' && parsed.pathname === '/auth') {
        let error: Error | undefined
        if (parsed.searchParams.get('error')) {
          const err = parsed.searchParams.get('error')!
          const errDescription = parsed.searchParams.get('error')!
          error = new Error(unescape(errDescription));
          (error as any).error = err
        }
        const code = parsed.searchParams.get('code') as string
        this.emit('microsoft-authorize-code', error, code)
        return true
      }
      return false
    })
  }

  async setName(name: string) {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    await this.mojangApi.setName(name, user.accessToken)
  }

  async getNameChangeInformation() {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    const result = await this.mojangApi.getNameChangeInformation(user.accessToken)
    return result
  }

  async checkNameAvailability(name: string) {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    const result = await this.mojangApi.checkNameAvailability(name, user.accessToken)
    return result
  }

  async hideCape() {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    await this.mojangApi.hideCape(user.accessToken)
  }

  async showCape(capeId: string) {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    await this.mojangApi.showCape(capeId, user.accessToken)
  }

  async verifySecurityLocation() {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    return await this.mojangApi.verifySecurityLocation(user.accessToken)
  }

  async getSecurityChallenges() {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    return await this.mojangApi.getSecurityChallenges(user.accessToken)
  }

  async submitSecurityChallenges(answers: MojangChallengeResponse[]) {
    const { user } = this.userService.state
    if (!user) {
      throw new Error()
    }
    return await this.mojangApi.submitSecurityChallenges(answers, user.accessToken)
  }
}
