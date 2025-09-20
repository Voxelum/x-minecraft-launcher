import { AUTHORITY_MICROSOFT, AuthorityMetadata, GameProfileAndTexture, LoginOptions, RefreshUserOptions, Skin, SkinPayload, UserException, UserProfile, normalizeUserId } from '@xmcl/runtime-api'
import { MicrosoftAuthenticator, MicrosoftMinecraftProfile, MojangClient, MojangError } from '@xmcl/user'
import { randomUUID } from 'crypto'
import { LauncherApp } from '~/app'
import { Logger } from '~/infra'
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
    private app: LauncherApp,
  ) { }

  getSupporetedAuthorityMetadata(): AuthorityMetadata[] {
    return [
      {
        authority: AUTHORITY_MICROSOFT,
        flow: ['device-code', 'grant-code'],
        emailOnly: true,
        kind: 'builtin',
      },
    ]
  }

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

  async refresh(user: UserProfile, signal: AbortSignal, { silent, force, validate }: RefreshUserOptions): Promise<UserProfile> {
    const diff = Date.now() - user.expiredAt
    this.logger.log(`Try to refresh Microsoft account ${user.username}(${user.id}) token. Expired at ${user.expiredAt}, validate: ${validate}, force: ${force}, diff: ${diff}, silent: ${silent}`)
    const isExpired = async () => {
      if (!validate) return false
      const userTokenStorage = await this.getUserTokenStorage()
      const accessToken = await userTokenStorage.get(user)
      const response = await this.app.fetch('https://sessionserver.mojang.com/session/minecraft/join', {
        signal,
        method: 'POST',
        body: JSON.stringify({
          accessToken,
          selectedProfile: user.selectedProfile,
          serverId: randomUUID(),
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      })
      this.logger.log(`Validate Microsoft account ${user.username}(${user.id}) token. Response: ${response.status}`)
      return !response.ok
    }
    if (force || !user.expiredAt || diff > 0 || (diff / 1000 / 3600 / 24) > 14 || user.invalidated || await isExpired()) {
      // expired
      this.logger.log('Microsoft accessToken expired. Refresh a new one.')
      try {
        const { accessToken, expiredAt, gameProfiles, selectedProfile, username } = await this.loginMicrosoft(user.username, undefined, false, true, signal, silent)

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
    const logError = (e: any) => {
      if (e.name === 'AbortError') {
        return
      }
      if (e.name === 'Error') {
        e.name = 'MicrosoftOLoginMicrosoftError'
      }
      this.logger.error(Object.assign(e, { scenario: 'loginMicrosoft' }))
    }
    const { result, extra } = await this.oauthClient.authenticate(microsoftEmailAddress, ['XboxLive.signin', 'XboxLive.offline_access'], {
      code: oauthCode,
      useDeviceCode,
      directRedirectToLauncher,
      signal,
      slientOnly,
    }).catch((e) => {
      logError(e)
      throw new UserException({ type: 'userAcquireMicrosoftTokenFailed' }, 'Failed to acquire Microsoft access token', { cause: e })
    })

    const isBadXstsResponse = (xstsResponse: XBoxResponse) => !xstsResponse.DisplayClaims || !xstsResponse.DisplayClaims.xui

    this.logger.log('Successfully get Microsoft access token')
    const oauthAccessToken = result.accessToken
    const { liveXstsResponse, minecraftXstsResponse } = await this.authenticator.acquireXBoxToken(oauthAccessToken, signal).catch((e) => {
      logError(e)
      const xErr = Number(e.XErr)
      throw new UserException({ type: 'userExchangeXboxTokenFailed', reason: xErr === 2148916233 ? 'NO_ACCOUNT' : [2148916238, 2148916236, 2148916227].includes(xErr) ? 'BAD_AGE' : undefined }, 'Failed to exchange Xbox token', { cause: e })
    })

    const aquireAccessToken = async (xstsResponse: XBoxResponse) => {
      if (isBadXstsResponse(xstsResponse)) {
        throw new UserException({ type: 'userExchangeXboxTokenFailed', reason: 'BAD_XSTS' }, 'Invalid XSTS response ' + JSON.stringify(xstsResponse))
      }

      this.logger.log('Successfully login Xbox')

      const mcResponse = await this.authenticator.loginMinecraftWithXBox(xstsResponse.DisplayClaims.xui[0].uhs, xstsResponse.Token, signal).catch((e) => {
        logError(e)
        throw new UserException({ type: 'userLoginMinecraftByXboxFailed' }, 'Failed to login Minecraft with Xbox', { cause: e })
      })
      this.logger.log('Successfully login Minecraft with Xbox')

      const ownershipResponse = await this.mojangClient.checkGameOwnership(mcResponse.access_token, signal).catch((e) => {
        logError(e)
        this.logger.warn(new UserException({ type: 'userCheckGameOwnershipFailed' }, 'Failed to check game ownership', { cause: e }))
        return { items: [] }
      })
      const ownGame = ownershipResponse.items.length > 0
      this.logger.log(`Successfully check ownership: ${ownGame}`)

      const gameProfileResponse = await this.mojangClient.getProfile(mcResponse.access_token, signal).catch((e) => {
        logError(e)
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
