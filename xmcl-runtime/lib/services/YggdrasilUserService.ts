/* eslint-disable quotes */
import { GameProfileAndTexture, LoginYggdrasilOptions, UserException, UserProfile, YggdrasilUserServiceKey } from '@xmcl/runtime-api'
import { AUTH_API_MOJANG, checkLocation, GameProfile, getChallenges, getTextures, login, lookup, lookupByName, MojangChallengeResponse, ProfileServiceAPI, PROFILE_API_MOJANG, refresh, responseChallenges, setTexture, validate, YggdrasilAuthAPI } from '@xmcl/user'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { normalizeGameProfile } from '../entities/user'
import { isSystemError } from '../util/error'
import { requireObject, requireString, toRecord } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { createDynamicThrottle } from '../util/trafficAgent'
import { AbstractService, Singleton } from './Service'
import { UserService } from './UserService'

export class YggdrasilUserService extends AbstractService {
  private lookup = createDynamicThrottle(lookup, (uuid, options = {}) => (options.api ?? PROFILE_API_MOJANG).profile, 2400)

  private validate = createDynamicThrottle(validate, ({ accessToken }, api) => (api ?? AUTH_API_MOJANG).hostName, 2400)

  // client data
  authServices: Record<string, YggdrasilAuthAPI> = {
    mojang: {
      hostName: 'https://authserver.mojang.com',
      authenticate: '/authenticate',
      refresh: '/refresh',
      validate: '/validate',
      invalidate: '/invalidate',
      signout: '/signout',
    },
    'ely.by': {
      hostName: 'https://authserver.ely.by',
      authenticate: '/auth/authenticate',
      refresh: '/auth/refresh',
      validate: '/auth/validate',
      invalidate: '/auth/invalidate',
      signout: '/auth/signout',
    },
  }

  profileServices: Record<string, ProfileServiceAPI> = {
    mojang: {
      publicKey: `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAylB4B6m5lz7jwrcFz6Fd
/fnfUhcvlxsTSn5kIK/2aGG1C3kMy4VjhwlxF6BFUSnfxhNswPjh3ZitkBxEAFY2
5uzkJFRwHwVA9mdwjashXILtR6OqdLXXFVyUPIURLOSWqGNBtb08EN5fMnG8iFLg
EJIBMxs9BvF3s3/FhuHyPKiVTZmXY0WY4ZyYqvoKR+XjaTRPPvBsDa4WI2u1zxXM
eHlodT3lnCzVvyOYBLXL6CJgByuOxccJ8hnXfF9yY4F0aeL080Jz/3+EBNG8RO4B
yhtBf4Ny8NQ6stWsjfeUIvH7bU/4zCYcYOq4WrInXHqS8qruDmIl7P5XXGcabuzQ
stPf/h2CRAUpP/PlHXcMlvewjmGU6MfDK+lifScNYwjPxRo4nKTGFZf/0aqHCh/E
AsQyLKrOIYRE0lDG3bzBh8ogIMLAugsAfBb6M3mqCqKaTMAf/VAjh5FFJnjS+7bE
+bZEV0qwax1CEoPPJL1fIQjOS8zj086gjpGRCtSy9+bTPTfTR/SJ+VUB5G2IeCIt
kNHpJX2ygojFZ9n5Fnj7R9ZnOM+L8nyIjPu3aePvtcrXlyLhH/hvOfIOjPxOlqW+
O5QwSFP4OEcyLAUgDdUgyW36Z5mB285uKW/ighzZsOTevVUG2QwDItObIV6i8RCx
FbN2oDHyPaO5j1tTaBNyVt8CAwEAAQ==
-----END PUBLIC KEY-----`,
      // eslint-disable-next-line no-template-curly-in-string
      texture: 'https://api.mojang.com/user/profile/${uuid}/${type}',
      // eslint-disable-next-line no-template-curly-in-string
      profile: 'https://sessionserver.mojang.com/session/minecraft/profile/${uuid}',
      // eslint-disable-next-line no-template-curly-in-string
      profileByName: 'https://api.mojang.com/users/profiles/minecraft/${name}',
    },
    'ely.by': {
      // eslint-disable-next-line no-template-curly-in-string
      profile: 'https://authserver.ely.by/session/profile/${uuid}',
      // eslint-disable-next-line no-template-curly-in-string
      profileByName: 'https://skinsystem.ely.by/textures/${name}',
      // eslint-disable-next-line no-template-curly-in-string
      texture: 'https://authserver.ely.by/session/profile/${uuid}/${type}',
    },
  }

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(UserService) private userService: UserService) {
    super(app, YggdrasilUserServiceKey)

    userService.registerAccountSystem({
      name: 'mojang',
      refresh: this.refresh.bind(this),
      getSkin: this.getSkin.bind(this),
      setSkin: this.setSkin.bind(this),
    })
  }

  async refresh(user: UserProfile, clientToken: string): Promise<UserProfile> {
    const authService = this.authServices[user.authService]
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

  async getSkin(user: UserProfile): Promise<UserProfile> {
    const gameProfile = user.profiles[user.selectedProfile]
    // if no game profile (maybe not logined), return
    if (gameProfile.name === '') return user
    // if user doesn't have a valid access token, return
    if (!user.accessToken) return user

    const { id, name } = gameProfile
    try {
      let profile: GameProfile
      const api = this.profileServices[user.profileService]
      const compatible = user.profileService === user.authService
      this.log(`Refresh skin for user ${gameProfile.name} in ${user.profileService} service ${compatible ? 'compatible' : 'incompatible'}`)

      if (!api) {
        this.warn(`Cannot find the profile service named ${user.profileService}. Use default mojang service`)
      }

      if (compatible) {
        profile = await this.lookup(id, { api })
      } else {
        // use name to look up
        profile = await lookupByName(name, { api })
        if (!profile) throw new Error(`Profile not found named ${name}!`)
        profile = await this.lookup(profile.id, { api })
      }
      const textures = getTextures(profile)
      const skin = textures?.textures.SKIN

      // mark skin already refreshed
      if (skin) {
        this.log(`Update the skin for user ${gameProfile.name} in ${user.profileService} service`)

        user.profiles[id] = {
          ...profile,
          textures: {
            ...textures.textures,
            SKIN: skin,
          },
        }
        return user
      } else {
        this.log(`The user ${gameProfile.name} in ${user.profileService} does not have skin!`)
      }
    } catch (e) {
      this.warn(`Cannot refresh the skin data for user ${name}(${id}) in ${user.profileService}`)
      this.warn(JSON.stringify(e))
    }

    return user
  }

  async setSkin(user: UserProfile, gameProfile: GameProfileAndTexture, skin: string | Buffer, slim: boolean): Promise<UserProfile> {
    this.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

    const profileService = this.profileServices[user.profileService]

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
    if (user.profileService !== 'mojang') return []
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
  }

  registerThirdPartyApi(name: string, authApi: YggdrasilAuthAPI, profileApi: ProfileServiceAPI) {
    this.profileServices[name] = profileApi
    this.authServices[name] = authApi
    this.userService.registerAccountSystem({
      name,
      refresh: this.refresh.bind(this),
      getSkin: this.getSkin.bind(this),
      setSkin: this.setSkin.bind(this),
    })
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
      profileService = 'mojang',
    } = options

    // enforce same service
    profileService = authService === 'offline' ? 'mojang' : authService

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

    const result = await login({
      username,
      password,
      requestUser: true,
      clientToken: this.userService.state.clientToken,
    }, usingAuthService).catch((e) => {
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
      profileService,
      authService,
    }

    return userProfile

    // this.refreshedSkin = false;

    // if (!this.state.users[userId]) {
    //   this.log(`New user added ${userId}`)

    //   this.state.userProfileAdd({
    //     id: userId,
    //     accessToken,
    //     profiles: availableProfiles,

    //     username,
    //     profileService,
    //     authService,

    //     msAccessToken,

    //     selectedProfile: selectedProfile ? selectedProfile.id : '',
    //     avatar,
    //     expiredAt,
    //   })
    // } else {
    //   this.log(`Found existed user ${userId}. Update the profiles of it`)
    //   this.state.userProfileUpdate({
    //     id: userId,
    //     accessToken,
    //     profiles: availableProfiles,
    //     msAccessToken,
    //     selectedProfile: selectedProfile ? selectedProfile.id : '',
    //     expiredAt,
    //   })
    // }
    // if ((!this.state.selectedUser.id || options.selectProfile) && selectedProfile) {
    //   this.log(`Select the game profile ${selectedProfile.id} in user ${userId}`)
    //   this.state.userGameProfileSelect({
    //     profileId: selectedProfile.id,
    //     userId,
    //   })
    // } else {
    //   this.log(`No game profiles found for user ${username} in ${authService}, ${profileService} services.`)
    // }
  }
}
