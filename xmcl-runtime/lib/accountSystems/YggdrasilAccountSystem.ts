import { GameProfileAndTexture, LoginOptions, SkinPayload, UserException, UserProfile } from '@xmcl/runtime-api'
import { getTextures } from '@xmcl/user'
import { UserAccountSystem } from '../services/UserService'
import { isSystemError } from '../util/error'
import { Logger } from '../util/log'
import { toRecord } from '../util/object'
import { YggdrasilThirdPartyClient } from '../clients/YggdrasilClient'
import { normalizeGameProfile, normalizeSkinData } from '../entities/user'
import { errors } from 'undici'

export class YggdrasilAccountSystem implements UserAccountSystem {
  constructor(private logger: Logger,
    private client: YggdrasilThirdPartyClient,
  ) {
  }

  async login({ username, password, service }: LoginOptions): Promise<UserProfile> {
    try {
      const auth = await this.client.login({
        username,
        password: password ?? '',
        requestUser: true,
      })
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

  async refresh(userProfile: UserProfile): Promise<UserProfile> {
    const valid = await this.client.validate(userProfile.accessToken)

    this.logger.log(`Validate ${userProfile.authService} user access token: ${valid ? 'valid' : 'invalid'}`)

    if (valid) {
      return userProfile
    }

    try {
      const result = await this.client.refresh({
        accessToken: userProfile.accessToken,
        requestUser: true,
      })
      this.logger.log(`Refreshed user access token for user: ${userProfile.id}`)

      userProfile.accessToken = result.accessToken
      userProfile.expiredAt = Date.now() + 86400_000
    } catch (e) {
      this.logger.error(e)
      this.logger.warn(`Invalid current user ${userProfile.id} accessToken!`)

      userProfile.accessToken = ''
    }

    return userProfile
  }

  async getSkin(userProfile: UserProfile): Promise<UserProfile> {
    const gameProfile = userProfile.profiles[userProfile.selectedProfile]
    // if no game profile (maybe not logined), return
    if (gameProfile.name === '') return userProfile
    // if user doesn't have a valid access token, return
    if (!userProfile.accessToken) return userProfile

    const { id, name } = gameProfile
    try {
      this.logger.log(`Refresh skin for user ${gameProfile.name}`)

      const profile = await this.client.lookup(id)
      const textures = getTextures(profile)
      const skin = textures?.textures.SKIN
      const uploadable = profile.properties.uploadableTextures

      // mark skin already refreshed
      if (skin) {
        this.logger.log(`Update the skin for user ${gameProfile.name}`)

        userProfile.profiles[id] = {
          ...profile,
          textures: {
            ...textures.textures,
            SKIN: skin,
          },
        }

        if (uploadable) {
          userProfile.profiles[id].uploadable = uploadable.split(',') as any
        }
      } else {
        this.logger.log(`The user ${gameProfile.name} does not have skin!`)
      }
    } catch (e) {
      this.logger.warn(`Cannot refresh the skin data for user ${name}(${id})`)
      this.logger.warn(JSON.stringify(e))
    }

    return userProfile
  }

  async setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, { cape, skin }: SkinPayload): Promise<UserProfile> {
    this.logger.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

    if (typeof cape === 'string' && gameProfile.uploadable?.indexOf('cape') !== -1) {
      if (cape === '') {
        await this.client.setTexture({
          uuid: gameProfile.id,
          accessToken: userProfile.accessToken,
          type: 'cape',
        })
      } else {
        const data = await normalizeSkinData(cape)
        await this.client.setTexture({
          uuid: gameProfile.id,
          accessToken: userProfile.accessToken,
          type: 'cape',
          texture: typeof data === 'string' ? { url: data } : { data: data },
        })
      }
    }

    if (gameProfile.uploadable?.indexOf('skin') !== -1 && typeof skin === 'object') {
      if (skin === null) {
        await this.client.setTexture({
          uuid: gameProfile.id,
          accessToken: userProfile.accessToken,
          type: 'skin',
        })
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
        })
      }
    }

    return userProfile
  }
}
