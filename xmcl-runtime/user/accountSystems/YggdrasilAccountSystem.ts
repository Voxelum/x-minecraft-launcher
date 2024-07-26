import { GameProfileAndTexture, LoginOptions, SkinPayload, UserException, UserProfile, normalizeUserId } from '@xmcl/runtime-api'
import { YggdrasilError, YggdrasilTexturesInfo, YggdrasilThirdPartyClient } from '@xmcl/user'
import { Dispatcher } from 'undici'
import { isSystemError } from '~/util/error'
import { Logger } from '~/logger'
import { toRecord } from '~/util/object'
import { isValidUrl } from '~/util/url'
import { normalizeGameProfile, normalizeSkinData } from '../user'
import { UserTokenStorage } from '../userTokenStore'
import { UserAccountSystem } from './AccountSystem'
import { LauncherApp } from '~/app'

export class YggdrasilAccountSystem implements UserAccountSystem {
  constructor(
    private app: LauncherApp,
    private logger: Logger,
    private clientToken: string,
    private storage: UserTokenStorage,
  ) {
  }

  protected getClient(authority: string) {
    if (!isValidUrl(authority)) {
      throw new TypeError('Invalid authority url ' + authority)
    }
    const client = new YggdrasilThirdPartyClient(
      authority,
      {
        fetch: (...args) => this.app.fetch(...args),
      },
      // eslint-disable-next-line no-template-curly-in-string
      // joinUrl(api.url, api.profile || '/sessionserver/session/minecraft/profile/${uuid}'),
      // eslint-disable-next-line no-template-curly-in-string
      // joinUrl(api.url, api.texture || '/api/user/profile/${uuid}/${type}'),
      // joinUrl(api.url, api.auth || '/authserver'),
      // () => this.userState.clientToken,
      // this.dispatcher,
    )

    return client
  }

  async #updateSkins(client: YggdrasilThirdPartyClient, userProfile: UserProfile, signal?: AbortSignal) {
    for (const p of Object.values(userProfile.profiles)) {
      const profile = await client.lookup(p.id, true, signal)
      const texturesBase64 = profile.properties.textures
      const textures = JSON.parse(Buffer.from(texturesBase64, 'base64').toString())
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
  }

  async login({ username, password, authority }: LoginOptions, signal?: AbortSignal): Promise<UserProfile> {
    const client = this.getClient(authority)
    if (!client) throw new UserException({ type: 'loginServiceNotSupported', authority }, `Service ${authority} is not supported`)

    try {
      const auth = await client.login({
        username,
        password: password ?? '',
        requestUser: true,
        clientToken: this.clientToken,
      }, signal)

      const userProfile: UserProfile = {
        id: normalizeUserId(auth.user!.id, authority),
        username,
        invalidated: false,
        profiles: toRecord(auth.availableProfiles.map(normalizeGameProfile), (v) => v.id),
        selectedProfile: auth.selectedProfile?.id ?? auth.availableProfiles[0]?.id ?? '',
        expiredAt: Date.now() + 86400_000,
        authority,
      }
      await this.storage.put(userProfile, auth.accessToken)

      await this.#updateSkins(client, userProfile, signal)

      return userProfile
    } catch (e: any) {
      if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
        throw new UserException({ type: 'loginInternetNotConnected' }, e.message || e.errorMessage, { cause: e })
      } else if (e.error === 'ForbiddenOperationException' &&
        e.errorMessage === 'Invalid credentials. Invalid username or password.') {
        throw new UserException({ type: 'loginInvalidCredentials' }, e.message || e.errorMessage, { cause: e })
      } else if (e.error === 'ForbiddenOperationException' &&
        e.errorMessage === 'Invalid credential information.') {
        throw new UserException({ type: 'loginInvalidCredentials' }, e.message || e.errorMessage, { cause: e })
      } else if (e.error === 'IllegalArgumentException') {
        throw new UserException({ type: 'loginInvalidCredentials' }, e.message || e.errorMessage, { cause: e })
      } else if (isSystemError(e)) {
        if (e.code === 'ETIMEDOUT') {
          throw new UserException({ type: 'loginTimeout' }, e.message, { cause: e })
        } else if (e.code === 'ECONNRESET') {
          throw new UserException({ type: 'loginReset' }, e.message, { cause: e })
        }
      } else if (e instanceof YggdrasilError) {
        throw new UserException({ type: 'loginInvalidCredentials' }, e.message || e.errorMessage, { cause: e })
      }
      throw new UserException({ type: 'loginGeneral' }, e.message || e.errorMessage, { cause: e })
    }
  }

  async refresh(userProfile: UserProfile, signal?: AbortSignal, _ = false, force = false): Promise<UserProfile> {
    const client = this.getClient(userProfile.authority)

    const token = await this.storage.get(userProfile)

    if (!token) {
      userProfile.invalidated = true
      return userProfile
    }

    const valid = await client.validate(token, this.clientToken, signal)

    this.logger.log(`Validate ${userProfile.authority} user access token: ${valid ? 'valid' : 'invalid'}`)

    if (!valid || force) {
      try {
        const result = await client.refresh({
          accessToken: token,
          requestUser: true,
          clientToken: this.clientToken,
        }, signal)
        this.logger.log(`Refreshed user access token for user: ${userProfile.id}`)

        await this.storage.put(userProfile, result.accessToken)
        userProfile.expiredAt = Date.now() + 86400_000
        userProfile.invalidated = false
      } catch (e) {
        this.logger.warn(e)
        this.logger.warn(`Invalid current user ${userProfile.id} accessToken!`)

        userProfile.invalidated = true
      }
    } else {
      userProfile.expiredAt = Date.now() + 86400_000
      userProfile.invalidated = false
    }

    await this.#updateSkins(client, userProfile, signal)

    return userProfile
  }

  async setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, { cape, skin }: SkinPayload, signal?: AbortSignal): Promise<UserProfile> {
    const client = this.getClient(userProfile.authority)

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
          texture: typeof data === 'string' ? { url: data } : { data },
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
              data,
            },
        }, signal)
      }
    }

    // Update the game profile
    const newGameProfile = await client.lookup(gameProfile.id, true, signal)
    const textures = JSON.parse(Buffer.from(newGameProfile.properties.textures, 'base64').toString()) as YggdrasilTexturesInfo
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
