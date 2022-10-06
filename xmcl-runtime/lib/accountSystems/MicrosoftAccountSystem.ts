import { GameProfileAndTexture, LoginOptions, SkinPayload, UserException, UserProfile } from '@xmcl/runtime-api'
import { UserAccountSystem } from '../services/UserService'
import { Logger } from '../util/log'
import { toRecord } from '../util/object'
import { MicrosoftAuthenticator } from '../clients/MicrosoftAuthenticator'
import { MojangClient } from '../clients/MojangClient'
import { MicrosoftOAuthClient } from '../clients/MicrosoftOAuthClient'
import { normalizeSkinData } from '../entities/user'

export class MicrosoftAccountSystem implements UserAccountSystem {
  constructor(
    private logger: Logger,
    private authenticator: MicrosoftAuthenticator,
    private mojangClient: MojangClient,
    private oauthClient: MicrosoftOAuthClient,
  ) { }

  async login(options: LoginOptions): Promise<UserProfile> {
    const properties = options.properties || {}
    const useDeviceCode = properties.mode === 'device'
    const directToLauncher = properties.mode === 'fast'
    const code = properties.code || ''
    const authentication = await this.loginMicrosoft(options.username, code, useDeviceCode, directToLauncher)

    return {
      id: authentication.userId,
      username: options.username,
      authService: options.service,
      accessToken: authentication.accessToken,
      expiredAt: authentication.expiredAt,
      profiles: toRecord(authentication.gameProfiles, p => p.id),
      selectedProfile: authentication.selectedProfile?.id ?? '',
      avatar: authentication.avatar,
    }
  }

  async refresh(user: UserProfile): Promise<UserProfile> {
    const diff = Date.now() - user.expiredAt
    if (!user.expiredAt || user.expiredAt < Date.now() || (diff / 1000 / 3600 / 24) > 14) {
      // expired
      this.logger.log('Microsoft accessToken expired. Refresh a new one.')
      try {
        const { accessToken, expiredAt, gameProfiles, selectedProfile } = await this.loginMicrosoft(user.username, undefined, false, true)

        user.accessToken = accessToken
        user.expiredAt = expiredAt
        user.selectedProfile = selectedProfile?.id ?? ''
        user.profiles = toRecord(gameProfiles, v => v.id)
      } catch (e) {
        this.logger.error(`Fail to refresh ${user.username}`)
        this.logger.error(e)
        user.accessToken = ''
      }
    }

    return user
  }

  async getSkin(userProfile: UserProfile): Promise<UserProfile> {
    const profile = await this.mojangClient.getProfile(userProfile.accessToken)

    userProfile.profiles[profile.id] = {
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
    return userProfile
  }

  async setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, options: SkinPayload): Promise<UserProfile> {
    if (typeof options.cape !== 'undefined') {
      if (options.cape === '') {
        await this.mojangClient.hideCape(userProfile.accessToken)
      } else {
        const target = gameProfile.capes?.find(c => c.url === options.cape)
        if (target) {
          await this.mojangClient.showCape(target.id, userProfile.accessToken)
        } else {
          throw new Error(`Cannot upload new cape for Microsoft account: ${gameProfile.name}(${userProfile.username})`)
        }
      }
    }
    if (typeof options.skin === 'object') {
      if (options.skin === null) {
        await this.mojangClient.resetSkin(userProfile.accessToken)
      } else {
        const profile = await this.mojangClient.setSkin(
          `${gameProfile.name}.png`,
          await normalizeSkinData(options.skin?.url),
          options.skin?.slim ? 'slim' : 'classic',
          userProfile.accessToken,
        )
        // @ts-ignore
        userProfile.profiles[gameProfile.id] = {
          ...gameProfile,
          ...profile,
          uploadable: ['skin', 'cape'],
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
      }
    }
    return userProfile
  }

  protected async loginMicrosoft(microsoftEmailAddress: string, oauthCode: string | undefined, useDeviceCode: boolean, directRedirectToLauncher: boolean) {
    const { result, extra } = await this.oauthClient.authenticate(microsoftEmailAddress, ['XboxLive.signin', 'XboxLive.offline_access'], {
      code: oauthCode,
      extraScopes: ['email', 'openid', 'offline_access'],
      useDeviceCode,
      directRedirectToLauncher,
    }).catch((e) => {
      this.logger.error(e)
      throw new UserException({ type: 'userAcquireMicrosoftTokenFailed', error: e.toString() })
    })

    this.logger.log('Successfully get Microsoft access token')
    const oauthAccessToken = result!.accessToken
    const { xstsResponse, xboxGameProfile } = await this.authenticator.acquireXBoxToken(oauthAccessToken).catch((e) => {
      this.logger.error(e)
      throw new UserException({ type: 'userExchangeXboxTokenFailed', error: e.toString() })
    })
    this.logger.log('Successfully login Xbox')

    const mcResponse = await this.authenticator.loginMinecraftWithXBox(xstsResponse.DisplayClaims.xui[0].uhs, xstsResponse.Token).catch((e) => {
      this.logger.error(e)
      throw new UserException({ type: 'userLoginMinecraftByXboxFailed', error: e.toString() })
    })
    this.logger.log('Successfully login Minecraft with Xbox')

    const ownershipResponse = await this.mojangClient.checkGameOwnership(mcResponse.access_token).catch((e) => {
      this.logger.error(e)
      throw new UserException({ type: 'userCheckGameOwnershipFailed', error: e.toString() })
    })
    const ownGame = ownershipResponse.items.length > 0
    this.logger.log(`Successfully check ownership: ${ownGame}`)

    if (ownGame) {
      const gameProfileResponse = await this.mojangClient.getProfile(mcResponse.access_token)
      this.logger.log('Successfully get game profile')
      const gameProfiles: GameProfileAndTexture[] = [{
        ...gameProfileResponse,
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
        msAccessToken: extra?.accessToken,
        selectedProfile: gameProfiles[0],
        avatar: xboxGameProfile.profileUsers[0].settings.find(v => v.id === 'PublicGamerpic')?.value,
        expiredAt: mcResponse.expires_in * 1000 + Date.now(),
      }
    }

    return {
      userId: mcResponse.username,
      accessToken: mcResponse.access_token,
      gameProfiles: [],
      msAccessToken: extra?.accessToken,
      selectedProfile: undefined,
      avatar: xboxGameProfile.profileUsers[0].settings.find(v => v.id === 'PublicGamerpic')?.value,
      expiredAt: mcResponse.expires_in * 1000 + Date.now(),
    }
  }
}
