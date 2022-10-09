import { GameProfileAndTexture, LoginOptions, SkinPayload, UserException, UserProfile } from '@xmcl/runtime-api'
import { getTextures } from '@xmcl/user'
import { UserAccountSystem } from '../services/UserService'
import { isSystemError } from '../util/error'
import { Logger } from '../util/log'
import { toRecord } from '../util/object'
import { YggdrasilThirdPartyClient } from '../clients/YggdrasilClient'
import { normalizeGameProfile, normalizeSkinData } from '../entities/user'

export class YggdrasilAccountSystem implements UserAccountSystem {
  constructor(private logger: Logger,
    private client: YggdrasilThirdPartyClient,
  ) {
  }

  async login({ username, password, service }: LoginOptions, signal?: AbortSignal): Promise<UserProfile> {
    try {
      const auth = await this.client.login({
        username,
        password: password ?? '',
        requestUser: true,
      }, signal)
      const userProfile: UserProfile = {
        id: auth.user!.id,
        accessToken: auth.accessToken,
        username,
        profiles: toRecord(auth.availableProfiles.map(normalizeGameProfile), (v) => v.id),
        selectedProfile: auth.selectedProfile?.id ?? auth.availableProfiles[0]?.id ?? '',
        expiredAt: Date.now() + 86400_000,
        authService: service,
      }

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
    const valid = await this.client.validate(userProfile.accessToken, signal)

    this.logger.log(`Validate ${userProfile.authService} user access token: ${valid ? 'valid' : 'invalid'}`)

    if (!valid) {
      try {
        const result = await this.client.refresh({
          accessToken: userProfile.accessToken,
          requestUser: true,
        }, signal)
        this.logger.log(`Refreshed user access token for user: ${userProfile.id}`)

        userProfile.accessToken = result.accessToken
        userProfile.expiredAt = Date.now() + 86400_000
      } catch (e) {
        this.logger.error(e)
        this.logger.warn(`Invalid current user ${userProfile.id} accessToken!`)

        userProfile.accessToken = ''
      }
    }

    for (const p of Object.values(userProfile.profiles)) {
      const profile = await this.client.lookup(p.id, true, signal)
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
    this.logger.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

    if (typeof cape === 'string' && gameProfile.uploadable?.indexOf('cape') !== -1) {
      if (cape === '') {
        await this.client.setTexture({
          uuid: gameProfile.id,
          accessToken: userProfile.accessToken,
          type: 'cape',
        }, signal)
      } else {
        const data = await normalizeSkinData(cape)
        await this.client.setTexture({
          uuid: gameProfile.id,
          accessToken: userProfile.accessToken,
          type: 'cape',
          texture: typeof data === 'string' ? { url: data } : { data: data },
        }, signal)
      }
    }

    if (gameProfile.uploadable?.indexOf('skin') !== -1 && typeof skin === 'object') {
      if (skin === null) {
        await this.client.setTexture({
          uuid: gameProfile.id,
          accessToken: userProfile.accessToken,
          type: 'skin',
        }, signal)
      } else {
        const data = await normalizeSkinData(skin.url)
        await this.client.setTexture({
          uuid: gameProfile.id,
          accessToken: userProfile.accessToken,
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
    const newGameProfile = await this.client.lookup(gameProfile.id, true, signal)
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
