import { GameProfileAndTexture, LoginOptions, SkinPayload, UserException, UserProfile, UserState } from '@xmcl/runtime-api'
import { getTextures } from '@xmcl/user'
import { Dispatcher } from 'undici'
import { YggdrasilThirdPartyClient } from '../clients/YggdrasilClient'
import { normalizeGameProfile, normalizeSkinData } from '../entities/user'
import { UserTokenStorage } from '../entities/userTokenStore'
import { isSystemError } from '../util/error'
import { Logger } from '../util/log'
import { toRecord } from '../util/object'
import { joinUrl } from '../util/url'
import { UserAccountSystem } from './AccountSystem'

export class YggdrasilAccountSystem implements UserAccountSystem {
  constructor(private logger: Logger,
    private dispatcher: Dispatcher,
    private userState: UserState,
    private storage: UserTokenStorage,
  ) {
  }

  protected getClient(service: string) {
    const api = this.userState.yggdrasilServices.find(s => new URL(s.url).hostname === service)

    if (!api) return undefined

    const client = new YggdrasilThirdPartyClient(
      // eslint-disable-next-line no-template-curly-in-string
      joinUrl(api.url, api.profile || '/sessionserver/session/minecraft/profile/${uuid}'),
      // eslint-disable-next-line no-template-curly-in-string
      joinUrl(api.url, api.texture || '/api/user/profile/${uuid}/${type}'),
      joinUrl(api.url, api.auth || '/authserver'),
      () => this.userState.clientToken,
      this.dispatcher,
    )

    return client
  }

  async login({ username, password, service }: LoginOptions, signal?: AbortSignal): Promise<UserProfile> {
    const client = this.getClient(service)
    if (!client) throw new UserException({ type: 'loginServiceNotSupported', service }, `Service ${service} is not supported`)

    try {
      const auth = await client.login({
        username,
        password: password ?? '',
        requestUser: true,
      }, signal)

      const userProfile: UserProfile = {
        id: auth.user!.id,
        username,
        invalidated: false,
        profiles: toRecord(auth.availableProfiles.map(normalizeGameProfile), (v) => v.id),
        selectedProfile: auth.selectedProfile?.id ?? auth.availableProfiles[0]?.id ?? '',
        expiredAt: Date.now() + 86400_000,
        authService: service,
      }
      await this.storage.put(userProfile, auth.accessToken)

      return userProfile
    } catch (e: any) {
      if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
        throw new UserException({ type: 'loginInternetNotConnected' }, e.message || e.errorMessage)
      } else if (e.error === 'ForbiddenOperationException' &&
        e.errorMessage === 'Invalid credentials. Invalid username or password.') {
        throw new UserException({ type: 'loginInvalidCredentials' }, e.message || e.errorMessage)
      } else if (e.error === 'ForbiddenOperationException' &&
        e.errorMessage === 'Invalid credential information.') {
        throw new UserException({ type: 'loginInvalidCredentials' }, e.message || e.errorMessage)
      } else if (e.error === 'IllegalArgumentException') {
        throw new UserException({ type: 'loginInvalidCredentials' }, e.message || e.errorMessage)
      } else if (isSystemError(e)) {
        if (e.code === 'ETIMEDOUT') {
          throw new UserException({ type: 'loginTimeout' }, e.message)
        } else if (e.code === 'ECONNRESET') {
          throw new UserException({ type: 'loginReset' }, e.message)
        }
      }
      throw new UserException({ type: 'loginGeneral' }, e.message)
    }
  }

  async refresh(userProfile: UserProfile, signal?: AbortSignal): Promise<UserProfile> {
    const client = this.getClient(userProfile.authService)
    if (!client) throw new UserException({ type: 'loginServiceNotSupported', service: userProfile.authService }, `Service ${userProfile.authService} is not supported`)

    const token = await this.storage.get(userProfile)

    if (!token) {
      userProfile.invalidated = true
      return userProfile
    }

    const valid = await client.validate(token, signal)

    this.logger.log(`Validate ${userProfile.authService} user access token: ${valid ? 'valid' : 'invalid'}`)

    if (!valid) {
      try {
        const result = await client.refresh({
          accessToken: token,
          requestUser: true,
        }, signal)
        this.logger.log(`Refreshed user access token for user: ${userProfile.id}`)

        await this.storage.put(userProfile, result.accessToken)
        userProfile.expiredAt = Date.now() + 86400_000
      } catch (e) {
        this.logger.error(e)
        this.logger.warn(`Invalid current user ${userProfile.id} accessToken!`)

        userProfile.invalidated = true
      }
    } else {
      userProfile.expiredAt = Date.now() + 86400_000
    }

    for (const p of Object.values(userProfile.profiles)) {
      const profile = await client.lookup(p.id, true, signal)
      const textures = getTextures(profile)
      const skin = textures?.textures.SKIN
      const uploadable = profile.properties.uploadableTextures

      // mark skin already refreshed
      if (skin) {
        this.logger.log(`Update the skin for profile ${p.name}`)

        userProfile.profiles[p.id] = {
          ...profile,
          textures: {
            ...textures.textures,
            SKIN: skin,
          },
          uploadable: uploadable ? uploadable.split(',') as any : undefined,
        }
      }
    }

    return userProfile
  }

  async setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, { cape, skin }: SkinPayload, signal?: AbortSignal): Promise<UserProfile> {
    const client = this.getClient(userProfile.authService)
    if (!client) throw new UserException({ type: 'loginServiceNotSupported', service: userProfile.authService }, `Service ${userProfile.authService} is not supported`)

    this.logger.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

    const token = await this.storage.get(userProfile)
    if (!token) {
      userProfile.invalidated = true
      return userProfile
    }
    if (typeof cape === 'string' && gameProfile.uploadable?.indexOf('cape') !== -1) {
      if (cape === '') {
        await client.setTexture({
          uuid: gameProfile.id,
          accessToken: token,
          type: 'cape',
        }, signal)
      } else {
        const data = await normalizeSkinData(cape)
        await client.setTexture({
          uuid: gameProfile.id,
          accessToken: token,
          type: 'cape',
          texture: typeof data === 'string' ? { url: data } : { data: data },
        }, signal)
      }
    }

    if (gameProfile.uploadable?.indexOf('skin') !== -1 && typeof skin === 'object') {
      if (skin === null) {
        await client.setTexture({
          uuid: gameProfile.id,
          accessToken: token,
          type: 'skin',
        }, signal)
      } else {
        const data = await normalizeSkinData(skin.url)
        await client.setTexture({
          uuid: gameProfile.id,
          accessToken: token,
          type: 'skin',
          texture: typeof data === 'string'
            ? {
              metadata: {
                model: skin.slim ? 'slim' : 'steve',
              },
              url: data,
            }
            : {
              metadata: {
                model: skin.slim ? 'slim' : 'steve',
              },
              data: data,
            },
        }, signal)
      }
    }

    // Update the game profile
    const newGameProfile = await client.lookup(gameProfile.id, true, signal)
    const textures = getTextures(newGameProfile)
    const uploadable = newGameProfile.properties.uploadableTextures

    if (textures?.textures.SKIN) {
      this.logger.log(`Update the skin for profile ${newGameProfile.name}`)

      userProfile.profiles[newGameProfile.id] = {
        ...newGameProfile,
        textures: {
          ...textures.textures,
          SKIN: textures?.textures.SKIN,
        },
        uploadable: uploadable ? uploadable.split(',') as any : undefined,
      }
    }

    return userProfile
  }
}
