/* eslint-disable quotes */
import { GameProfileAndTexture, LoginYggdrasilOptions, UserException, UserProfile, YggdrasilUserService as IYggdrasilUserService, YggdrasilUserServiceKey } from '@xmcl/runtime-api'
import { AUTH_API_MOJANG, checkLocation, getChallenges, getTextures, login, lookup, MojangChallengeResponse, ProfileServiceAPI, PROFILE_API_MOJANG, refresh, setTexture, validate, YggdrasilAuthAPI } from '@xmcl/user'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { normalizeGameProfile } from '../entities/user'
import { isSystemError } from '../util/error'
import { requireObject, requireString, toRecord } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { createDynamicThrottle } from '../util/trafficAgent'
import { AbstractService, ExposeServiceKey, Singleton } from './Service'
import { UserService } from './UserService'

@ExposeServiceKey(YggdrasilUserServiceKey)
export class YggdrasilUserService extends AbstractService implements IYggdrasilUserService {
  private lookup = createDynamicThrottle(lookup, (uuid, options = {}) => (options.api ?? PROFILE_API_MOJANG).profile, 2400)

  private validate = createDynamicThrottle(validate, ({ accessToken }, api) => (api ?? AUTH_API_MOJANG).hostName, 2400)

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(UserService) private userService: UserService) {
    super(app, YggdrasilUserServiceKey)
  }

  async refresh(user: UserProfile, clientToken: string, authService: YggdrasilAuthAPI): Promise<UserProfile> {
    const valid = await this.validate({
      accessToken: user.accessToken,
      clientToken: clientToken,
    }, authService).catch((e) => {
      this.error(e)
      return false
    })

    this.log(`Validate ${user.authService} user access token: ${valid ? 'valid' : 'invalid'}`)

    if (valid) {
      this.checkLocation(user)
      return user
    }
    try {
      const result = await refresh({
        accessToken: user.accessToken,
        clientToken: clientToken,
      }, authService)
      this.log(`Refreshed user access token for user: ${user.id}`)

      user.accessToken = result.accessToken
      user.expiredAt = Date.now() + 86400_000
      this.checkLocation(user)
      return user
    } catch (e) {
      this.error(e)
      this.warn(`Invalid current user ${user.id} accessToken!`)
    }

    return user
  }

  async getSkin(user: UserProfile, api: ProfileServiceAPI): Promise<UserProfile> {
    const gameProfile = user.profiles[user.selectedProfile]
    // if no game profile (maybe not logined), return
    if (gameProfile.name === '') return user
    // if user doesn't have a valid access token, return
    if (!user.accessToken) return user

    const { id, name } = gameProfile
    try {
      this.log(`Refresh skin for user ${gameProfile.name} in ${api.profile}`)

      const profile = await this.lookup(id, { api })
      const textures = getTextures(profile)
      const skin = textures?.textures.SKIN
      const uploadable = profile.properties.uploadableTextures

      // mark skin already refreshed
      if (skin) {
        this.log(`Update the skin for user ${gameProfile.name} in ${api.profile} service`)

        user.profiles[id] = {
          ...profile,
          textures: {
            ...textures.textures,
            SKIN: skin,
          },
        }

        if (uploadable) {
          user.profiles[id].uploadable = uploadable.split(',') as any
        }
      } else {
        this.log(`The user ${gameProfile.name} in ${api.profile} does not have skin!`)
      }
    } catch (e) {
      this.warn(`Cannot refresh the skin data for user ${name}(${id}) in ${api.profile}`)
      this.warn(JSON.stringify(e))
    }

    return user
  }

  async setSkin(user: UserProfile, gameProfile: GameProfileAndTexture, skin: string | Buffer, slim: boolean, profileService: ProfileServiceAPI): Promise<UserProfile> {
    this.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

    await setTexture({
      uuid: gameProfile.id,
      accessToken: user.accessToken,
      type: 'skin',
      texture: typeof skin === 'string'
        ? {
          metadata: {
            model: slim ? 'slim' : 'steve',
          },
          url: skin,
        }
        : {
          metadata: {
            model: slim ? 'slim' : 'steve',
          },
          data: skin,
        },
    }, profileService)

    return user
  }

  @Singleton()
  async checkLocation(user: UserProfile) {
    if (user.authService !== 'mojang') return true
    function isCommonError(e: any): e is { error: string; errorMessage: string } {
      return e && typeof e === 'object' && typeof e.error === 'string' && typeof e.errorMessage === 'string'
    }
    try {
      const result = await checkLocation(user.accessToken)
      // this.state.userSecurity(result)
      return result
    } catch (e) {
      if (isCommonError(e) && e.error === 'ForbiddenOperationException' && e.errorMessage === 'Current IP is not secured') {
        // this.state.userSecurity(false)
        return false
      }
      throw e
    }
  }

  async getChallenges(user: UserProfile) {
    if (!user) { return [] }
    return getChallenges(user.accessToken)
  }

  async submitChallenges(responses: MojangChallengeResponse[]) {
    // const user = this.state.user
    // if (!this.state.isAccessTokenValid || !user) throw new Error('Cannot submit challenge if not logined')
    // if (user.authService !== 'mojang') throw new Error('Cannot submit challenge if login mode is not mojang!')
    // if (!(responses instanceof Array)) throw new Error('Expect responses Array!')
    // const result = await responseChallenges(user.accessToken, responses)
    // this.state.userSecurity(true)
    // return result
    return true
  }

  async login_({ username, password }: { username: string; password: string }, authService: string, api: YggdrasilAuthAPI) {
    const result = await login({
      username,
      password,
      requestUser: true,
      clientToken: this.userService.state.clientToken,
    }, api).catch((e) => {
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
      username,
      profiles: toRecord(result.availableProfiles.map(normalizeGameProfile), (v) => v.id),
      selectedProfile: result.selectedProfile?.id ?? '',
      expiredAt: Date.now() + 86400_000,
      authService,
    }

    return userProfile
  }

  /**
   * Login the user by current login mode. Refresh the skin and account information.
   */
  @Singleton()
  async login(options: LoginYggdrasilOptions) {
    requireObject(options)
    requireString(options.username)

    let {
      username,
      password,
      authService = password ? 'mojang' : 'offline',
    } = options

    const usingAuthService = this.authServices[authService]
    password = password ?? ''

    if (authService !== 'offline' && authService !== 'microsoft' && !usingAuthService) {
      throw new Error(`Cannot find auth service named ${authService}`)
    }

    this.log(`Try login username: ${username} ${password ? 'with password' : 'without password'} to auth ${authService} and profile ${profileService}`)

    if (authService !== 'offline' && authService !== 'microsoft') {
      this.emit('user-login', usingAuthService.hostName)
    } else {
      this.emit('user-login', authService)
    }

    await this.login_({ username, password }, authService, usingAuthService)
  }
}
