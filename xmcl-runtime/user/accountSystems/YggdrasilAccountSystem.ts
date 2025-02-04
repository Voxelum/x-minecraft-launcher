import { AuthorityMetadata, GameProfileAndTexture, LoginOptions, OICDLikeConfig, RefreshUserOptions, SkinPayload, UserException, UserProfile, normalizeUserId } from '@xmcl/runtime-api'
import { GameProfile, YggdrasilError, YggdrasilTexturesInfo, YggdrasilThirdPartyClient } from '@xmcl/user'
import { LauncherApp } from '~/app'
import { Logger } from '~/logger'
import { isSystemError } from '~/util/error'
import { toRecord } from '~/util/object'
import { isValidUrl } from '~/util/url'
import { normalizeGameProfile, normalizeSkinData, transformGameProfileTexture } from '../user'
import { UserTokenStorage } from '../userTokenStore'
import { UserAccountSystem } from './AccountSystem'
import { YggdrasilSeriveRegistry } from '../YggdrasilSeriveRegistry'
import { YggdrasilOCIDAuthClient } from './YggdrasilOCIDAuthClient'

export const kYggdrasilAccountSystem = Symbol('YggdrasilAccountSystem')
export class YggdrasilAccountSystem implements UserAccountSystem {
  constructor(
    private app: LauncherApp,
    private logger: Logger,
    private clientToken: string,
    private storage: UserTokenStorage,
    private registry: YggdrasilSeriveRegistry,
    private ocidClient: YggdrasilOCIDAuthClient,
  ) {
  }

  getSupporetedAuthorityMetadata(): AuthorityMetadata[] {
    return this.registry.getYggdrasilServices().map(s => ({
      authority: s.url,
      flow: s.ocidConfig ? ['device-code', 'password'] : ['password'],
      authlibInjector: s.authlibInjector,
      emailOnly: false,
      favicon: s.favicon,
      kind: 'yggdrasil',
    }))
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
      try {
        const transformed = transformGameProfileTexture(profile)
        if (!transformed) continue
        userProfile.profiles[p.id] = transformed
      } catch (e) {
        this.logger.error(e as Error)
        this.logger.warn('Fail to update skins', p, profile)
      }
    }
  }

  async #loginOCID(ocidConfig: OICDLikeConfig, authority: string, username: string, slientOnly: boolean, homeAccountId?: string, signal?: AbortSignal): Promise<UserProfile> {
    const client = this.ocidClient
    const id = this.registry.getClientId(ocidConfig.issuer)

    if (!id) {
      throw new UserException({ type: 'loginServiceNotSupported', authority }, `Service ${authority} is not supported`)
    }

    const { result } = await client.authenticate(ocidConfig.issuer, id, username, ['Yggdrasil.Server.Join', 'Yggdrasil.PlayerProfiles.Select', 'openid', 'offline_access'], {
      signal,
      slientOnly,
      homeAccountId,
    })

    const selectedProfileRaw = 'selectedProfile' in result.idTokenClaims ? result.idTokenClaims.selectedProfile as any : undefined
    if (!selectedProfileRaw) {
      throw new UserException({ type: 'fetchMinecraftProfileFailed', errorType: 'NOT_FOUND', error: 'NOT_FOUND', errorMessage: `No user profile@${authority}`, developerMessage: `No user profile@${authority}` },)
    }

    const selectedProfile = { ...selectedProfileRaw, properties: Object.fromEntries(selectedProfileRaw.properties.map((p: any) => [p.name, p.value])) } as GameProfile
    const transformed = transformGameProfileTexture(selectedProfile)
    if (!transformed) {
      throw new UserException({ type: 'fetchMinecraftProfileFailed', errorType: 'BadProfile', error: 'BadProfile', errorMessage: `BadProfile@${authority}`, developerMessage: `BadProfile@${authority}` },)
    }
    const profile = {
      id: normalizeUserId(result.uniqueId, authority),
      username: username,
      invalidated: false,
      profiles: {
        [selectedProfile.id]: transformed,
      },
      selectedProfile: selectedProfile.id,
      expiredAt: result.expiresOn?.getTime() || Date.now() + 86400_000,
      authority: authority,
      homeAccountId: result.uniqueId,
    } as UserProfile
    await this.storage.put(profile, result.accessToken)
    return profile
  }

  async login({ username, password, authority, properties }: LoginOptions, signal?: AbortSignal): Promise<UserProfile> {
    const auth = this.registry.getYggdrasilServices().find(s => s.url === authority)

    if (auth?.ocidConfig && properties?.mode === 'device') {
      const result = await this.#loginOCID(auth.ocidConfig, authority, username, false, undefined, signal)
      return result
    }

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
      } else if (e.error === 'ForbiddenOperationException') {
        throw new UserException({ type: 'loginGeneral' }, e.message || e.errorMessage, { cause: e })
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

  async refresh(userProfile: UserProfile, signal: AbortSignal, { force, silent }: RefreshUserOptions): Promise<UserProfile> {
    const auth = this.registry.getYggdrasilServices().find(s => s.url === userProfile.authority)

    if (auth?.ocidConfig && userProfile.homeAccountId) {
      const diff = Date.now() - userProfile.expiredAt
      if (force || !userProfile.expiredAt || diff > 0 || (diff / 1000 / 3600 / 24) > 14 || userProfile.invalidated) {
        const result = await this.#loginOCID(auth.ocidConfig, userProfile.authority, userProfile.username, silent ?? true, userProfile.homeAccountId, signal)
        return result
      }

      return userProfile
    }

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
