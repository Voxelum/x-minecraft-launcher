import { GameProfileAndTexture, LoginOptions, Skin, SkinPayload, UserException, UserProfile } from '@xmcl/runtime-api'
import { Logger } from '../util/log'
import { toRecord } from '../util/object'
import { MicrosoftAuthenticator } from '../clients/MicrosoftAuthenticator'
import { MojangClient } from '../clients/MojangClient'
import { MicrosoftOAuthClient } from '../clients/MicrosoftOAuthClient'
import { XBoxResponse, normalizeSkinData } from '../entities/user'
import { UserTokenStorage } from '../entities/userTokenStore'
import { UserAccountSystem } from './AccountSystem'

export class MicrosoftAccountSystem implements UserAccountSystem {
  constructor(
    private logger: Logger,
    private authenticator: MicrosoftAuthenticator,
    private mojangClient: MojangClient,
    private userTokenStorage: UserTokenStorage,
    private oauthClient: MicrosoftOAuthClient,
  ) { }

  async login(options: LoginOptions, signal: AbortSignal): Promise<UserProfile> {
    const properties = options.properties || {}
    const useDeviceCode = properties.mode === 'device'
    const directToLauncher = properties.mode === 'fast'
    const code = properties.code || ''
    const authentication = await this.loginMicrosoft(options.username, code, useDeviceCode, directToLauncher, signal)

    const profile = {
      id: authentication.userId,
      username: options.username,
      invalidated: false,
      authService: options.service,
      expiredAt: authentication.expiredAt,
      profiles: toRecord(authentication.gameProfiles, p => p.id),
      selectedProfile: authentication.selectedProfile?.id ?? '',
      avatar: authentication.avatar,
    }
    await this.userTokenStorage.put(profile, authentication.accessToken)
    return profile
  }

  async refresh(user: UserProfile, signal: AbortSignal): Promise<UserProfile> {
    const diff = Date.now() - user.expiredAt
    if (!user.expiredAt || diff > 0 || (diff / 1000 / 3600 / 24) > 14 || user.invalidated) {
      // expired
      this.logger.log('Microsoft accessToken expired. Refresh a new one.')
      try {
        const { accessToken, expiredAt, gameProfiles, selectedProfile } = await this.loginMicrosoft(user.username, undefined, false, true, signal)

        user.expiredAt = expiredAt
        user.selectedProfile = selectedProfile?.id ?? ''
        user.profiles = toRecord(gameProfiles, v => v.id)
        user.invalidated = false
        await this.userTokenStorage.put(user, accessToken)
      } catch (e) {
        this.logger.error(new Error(`Fail to refresh ${user.username}`, { cause: e }))
        user.invalidated = true
        await this.userTokenStorage.put(user, '')
      }
    }

    return user
  }

  async setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, options: SkinPayload, signal: AbortSignal): Promise<UserProfile> {
    const token = await this.userTokenStorage.get(userProfile)
    if (!token) {
      userProfile.invalidated = true
      return userProfile
    }
    if (typeof options.cape !== 'undefined') {
      if (options.cape === '') {
        await this.mojangClient.hideCape(token, signal)
      } else {
        const target = gameProfile.capes?.find(c => c.url === options.cape)
        if (target) {
          await this.mojangClient.showCape(target.id, token, signal)
        } else {
          throw new Error(`Cannot upload new cape for Microsoft account: ${gameProfile.name}(${userProfile.username})`)
        }
      }
    }
    if (typeof options.skin === 'object') {
      if (options.skin === null) {
        await this.mojangClient.resetSkin(token, signal)
      } else {
        const profile = await this.mojangClient.setSkin(
          `${gameProfile.name}.png`,
          await normalizeSkinData(options.skin?.url),
          options.skin?.slim ? 'slim' : 'classic',
          token,
          signal,
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

  protected async loginMicrosoft(microsoftEmailAddress: string, oauthCode: string | undefined, useDeviceCode: boolean, directRedirectToLauncher: boolean, signal: AbortSignal) {
    const { result, extra } = await this.oauthClient.authenticate(microsoftEmailAddress, ['XboxLive.signin', 'XboxLive.offline_access'], {
      code: oauthCode,
      useDeviceCode,
      directRedirectToLauncher,
      signal,
    }).catch((e) => {
      this.logger.error(e)
      throw new UserException({ type: 'userAcquireMicrosoftTokenFailed' }, 'Failed to acquire Microsoft access token', { cause: e })
    })

    const isBadXstsResponse = (xstsResponse: XBoxResponse) => !xstsResponse.DisplayClaims || !xstsResponse.DisplayClaims.xui

    this.logger.log('Successfully get Microsoft access token')
    const oauthAccessToken = result!.accessToken
    const { liveXstsResponse, minecraftXstsResponse } = await this.authenticator.acquireXBoxToken(oauthAccessToken, signal).catch((e) => {
      throw new UserException({ type: 'userExchangeXboxTokenFailed' }, 'Failed to exchange Xbox token', { cause: e })
    })

    const aquireAccessToken = async (xstsResponse: XBoxResponse) => {
      if (isBadXstsResponse(xstsResponse)) {
        throw new UserException({ type: 'userExchangeXboxTokenFailed' }, 'Invalid XSTS response ' + JSON.stringify(xstsResponse))
      }

      this.logger.log('Successfully login Xbox')

      const mcResponse = await this.authenticator.loginMinecraftWithXBox(xstsResponse.DisplayClaims.xui[0].uhs, xstsResponse.Token, signal).catch((e) => {
        throw new UserException({ type: 'userLoginMinecraftByXboxFailed' }, 'Failed to login Minecraft with Xbox', { cause: e })
      })
      this.logger.log('Successfully login Minecraft with Xbox')

      const ownershipResponse = await this.mojangClient.checkGameOwnership(mcResponse.access_token, signal).catch((e) => {
        throw new UserException({ type: 'userCheckGameOwnershipFailed' }, 'Failed to check game ownership', { cause: e })
      })
      const ownGame = ownershipResponse.items.length > 0
      this.logger.log(`Successfully check ownership: ${ownGame}`)

      if (ownGame) {
        const gameProfileResponse = await this.mojangClient.getProfile(mcResponse.access_token, signal)
        this.logger.log('Successfully get game profile')
        const skin: Skin | undefined = gameProfileResponse.skins?.[0]
        const gameProfiles: GameProfileAndTexture[] = [{
          ...gameProfileResponse,
          id: gameProfileResponse.id,
          name: gameProfileResponse.name,
          textures: {
            SKIN: {
              url: skin?.url,
              metadata: { model: skin?.variant === 'CLASSIC' ? 'steve' : 'slim' },
            },
            CAPE: gameProfileResponse.capes && gameProfileResponse.capes.length > 0
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
          expiredAt: mcResponse.expires_in * 1000 + Date.now(),
        }
      }
      return {
        userId: mcResponse.username,
        accessToken: mcResponse.access_token,
        gameProfiles: [],
        msAccessToken: extra?.accessToken,
        selectedProfile: undefined,
        expiredAt: mcResponse.expires_in * 1000 + Date.now(),
      }
    }

    const acquireXboxAvatar = async (xstsResponse: XBoxResponse) => {
      if (isBadXstsResponse(xstsResponse)) {
        throw new Error('Invalid XSTS response ' + JSON.stringify(xstsResponse))
      }
      const xboxGameProfile = await this.authenticator.getXboxGameProfile(xstsResponse.DisplayClaims.xui[0].xid, xstsResponse.DisplayClaims.xui[0].uhs, xstsResponse.Token, signal)
      return xboxGameProfile.profileUsers[0].settings.find(v => v.id === 'PublicGamerpic')?.value
    }

    const [profile, avatar] = await Promise.all([
      aquireAccessToken(minecraftXstsResponse),
      acquireXboxAvatar(liveXstsResponse).catch(e => {
        this.logger.error(e)
        return undefined
      }),
    ])

    return {
      ...profile,
      avatar,
    }
  }
}
