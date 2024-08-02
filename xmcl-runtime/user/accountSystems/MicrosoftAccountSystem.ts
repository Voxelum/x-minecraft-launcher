import { GameProfileAndTexture, LoginOptions, Skin, SkinPayload, UserException, UserProfile, normalizeUserId } from '@xmcl/runtime-api'
import { MicrosoftAuthenticator, MicrosoftMinecraftProfile, MojangClient, MojangError, ProfileNotFoundError, UnauthorizedError } from '@xmcl/user'
import { Logger } from '~/logger'
import { toRecord } from '~/util/object'
import { XBoxResponse, normalizeSkinData } from '../user'
import { UserTokenStorage } from '../userTokenStore'
import { UserAccountSystem } from './AccountSystem'
import { MicrosoftOAuthClient } from './MicrosoftOAuthClient'

export class MicrosoftAccountSystem implements UserAccountSystem {
  constructor(
    private logger: Logger,
    private authenticator: MicrosoftAuthenticator,
    private mojangClient: MojangClient,
    private getUserTokenStorage: () => Promise<UserTokenStorage>,
    private oauthClient: MicrosoftOAuthClient,
  ) { }

  async login(options: LoginOptions, signal: AbortSignal): Promise<UserProfile> {
    const properties = options.properties || {}
    const useDeviceCode = properties.mode === 'device'
    const directToLauncher = properties.mode === 'fast'
    const code = properties.code || ''
    const authentication = await this.loginMicrosoft(options.username, code, useDeviceCode, directToLauncher, signal, false)

    const profile: UserProfile = {
      id: normalizeUserId(authentication.userId, options.authority),
      username: authentication.username || options.username,
      invalidated: false,
      authority: options.authority,
      expiredAt: authentication.expiredAt,
      profiles: toRecord(authentication.gameProfiles, p => p.id),
      selectedProfile: authentication.selectedProfile?.id ?? '',
      avatar: authentication.avatar,
    }
    const userTokenStorage = await this.getUserTokenStorage()
    await userTokenStorage.put(profile, authentication.accessToken)
    return profile
  }

  async refresh(user: UserProfile, signal: AbortSignal, slientOnly = false, force = false): Promise<UserProfile> {
    const diff = Date.now() - user.expiredAt
    if (force || !user.expiredAt || diff > 0 || (diff / 1000 / 3600 / 24) > 14 || user.invalidated) {
      // expired
      this.logger.log('Microsoft accessToken expired. Refresh a new one.')
      try {
        const { accessToken, expiredAt, gameProfiles, selectedProfile, username } = await this.loginMicrosoft(user.username, undefined, false, true, signal, slientOnly)

        user.username = username || user.username
        user.expiredAt = expiredAt
        user.selectedProfile = selectedProfile?.id ?? ''
        user.profiles = toRecord(gameProfiles, v => v.id)
        user.invalidated = false
        const userTokenStorage = await this.getUserTokenStorage()
        await userTokenStorage.put(user, accessToken)
      } catch (e) {
        this.logger.error(e as any)
        user.invalidated = true
        const userTokenStorage = await this.getUserTokenStorage()
        await userTokenStorage.put(user, '')
      }
    }

    return user
  }

  async setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, options: SkinPayload, signal: AbortSignal): Promise<UserProfile> {
    const userTokenStorage = await this.getUserTokenStorage()
    const token = await userTokenStorage.get(userProfile)
    if (!token) {
      userProfile.invalidated = true
      return userProfile
    }

    let newProfile: MicrosoftMinecraftProfile | undefined
    if (typeof options.cape !== 'undefined') {
      if (options.cape === '') {
        await this.mojangClient.hideCape(token, signal)
      } else {
        const target = gameProfile.capes?.find(c => c.url === options.cape)
        if (target) {
          newProfile = await this.mojangClient.showCape(target.id, token, signal)
        } else {
          throw new Error(`Cannot upload new cape for Microsoft account: ${gameProfile.name}(${userProfile.username})`)
        }
      }
    }
    if (typeof options.skin === 'object') {
      if (options.skin === null) {
        await this.mojangClient.resetSkin(token, signal)
      } else {
        newProfile = await this.mojangClient.setSkin(
          `${gameProfile.name}.png`,
          await normalizeSkinData(options.skin?.url),
          options.skin?.slim ? 'slim' : 'classic',
          token,
          signal,
        ) as any
      }
    }

    if (newProfile) {
      // @ts-ignore
      userProfile.profiles[gameProfile.id] = {
        ...gameProfile,
        ...newProfile,
        uploadable: ['skin', 'cape'],
        textures: {
          SKIN: {
            url: newProfile.skins[0].url,
            metadata: { model: newProfile.skins[0].variant === 'CLASSIC' ? 'steve' : 'slim' },
          },
          CAPE: newProfile.capes.length > 0
            ? {
              url: newProfile.capes[0].url,
            }
            : undefined,
        },
      }
    }

    return userProfile
  }

  protected async loginMicrosoft(microsoftEmailAddress: string, oauthCode: string | undefined, useDeviceCode: boolean, directRedirectToLauncher: boolean, signal: AbortSignal, slientOnly = false) {
    const { result, extra } = await this.oauthClient.authenticate(microsoftEmailAddress, ['XboxLive.signin', 'XboxLive.offline_access'], {
      code: oauthCode,
      useDeviceCode,
      directRedirectToLauncher,
      signal,
      slientOnly,
    }).catch((e) => {
      this.logger.error(e)
      throw new UserException({ type: 'userAcquireMicrosoftTokenFailed' }, 'Failed to acquire Microsoft access token', { cause: e })
    })

    const isBadXstsResponse = (xstsResponse: XBoxResponse) => !xstsResponse.DisplayClaims || !xstsResponse.DisplayClaims.xui

    this.logger.log('Successfully get Microsoft access token')
    const oauthAccessToken = result.accessToken
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
        this.logger.warn(new UserException({ type: 'userCheckGameOwnershipFailed' }, 'Failed to check game ownership', { cause: e }))
        return { items: [] }
      })
      const ownGame = ownershipResponse.items.length > 0
      this.logger.log(`Successfully check ownership: ${ownGame}`)

      const gameProfileResponse = await this.mojangClient.getProfile(mcResponse.access_token, signal).catch((e) => {
        this.logger.warn(e)
        if (e instanceof MojangError) {
          throw new UserException({
            type: 'fetchMinecraftProfileFailed',
            errorType: e.name,
            error: (e as any).error,
            errorMessage: e.errorMessage,
            developerMessage: e.developerMessage,
          }, 'Failed to get Microsoft account game profile', { cause: e })
        }
        throw new UserException({
          type: 'fetchMinecraftProfileFailed',
          errorType: 'Unknown',
          error: 'Unknown',
          errorMessage: '',
          developerMessage: '',
        }, 'Failed to get Microsoft account game profile', { cause: e })
      })
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
        username: result.account?.username,
        userId: mcResponse.username,
        accessToken: mcResponse.access_token,
        gameProfiles,
        msAccessToken: extra?.accessToken,
        selectedProfile: gameProfiles[0],
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
