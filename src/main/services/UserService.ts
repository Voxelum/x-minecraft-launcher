import { DownloadTask } from '@xmcl/installer'
import { AUTH_API_MOJANG, checkLocation, GameProfile, getChallenges, getTextures, invalidate, login, lookup, lookupByName, MojangChallengeResponse, offline, PROFILE_API_MOJANG, refresh, responseChallenges, setTexture, validate } from '@xmcl/user'
import { readFile, readJSON } from 'fs-extra'
import { URL } from 'url'
import { v4 } from 'uuid'
import { MappedFile } from '../util/persistance'
import { BufferJsonSerializer } from '../util/serialize'
import AbstractService, { ExportService, Singleton } from './Service'
import LauncherApp from '/@main/app/LauncherApp'
import { aquireXBoxToken, checkGameOwnership, getGameProfile, loginMinecraftWithXBox } from '/@main/entities/user'
import { createhDynamicThrottle as createDynamicThrottle } from '/@main/util/trafficAgent'
import { fitMinecraftLauncherProfileData } from '/@main/util/userData'
import { Exception } from '/@shared/entities/exception'
import { GameProfileAndTexture, UserSchema } from '/@shared/entities/user.schema'
import {
  LoginMicrosoftOptions, LoginOptions,
  RefreshSkinOptions,
  UploadSkinOptions, UserService as IUserService, UserServiceKey,
} from '/@shared/services/UserService'
import { requireNonnull, requireObject, requireString } from '/@shared/util/assert'

export interface LauncherProfile {
  /**
   * All the launcher profiles and their configurations.
   */
  profiles: {
    [name: string]: {
      name: string
      /**
       * The profile type.
       * Types are custom (manually created by the user),
       * latest-release (uses the latest stable release),
       * and latest-snapshot (uses the latest build of Minecraft).
       */
      type: string
      gameDir: string
      javaDir: string
      javaArgs: string
      /**
       * The version ID that the profile targets. Version IDs are determined in the version.json in every directory in ~/versions
       */
      lastVersionId: string
      /**
       * An Base64-encoded image which represents the icon of the profile in the profiles menu.
       */
      icon: string
      created: string
      /**
       * An ISO 8601 formatted date which represents the last time the profile was used.
       */
      lastUsed: string
    }
  }
  clientToken: string
  /**
   * All the logged in accounts.
   * Every account in this key contains a UUID-hashed map (which is used to save the selected user)
   * which in turn includes the access token, e-mail, and a profile (which contains the account display name)
   */
  authenticationDatabase: {
    [uuid: string]: {
      accessToken: string
      username: string
      profiles: {
        [uuid: string]: {
          displayName: string
        }
      }
      properties: object[]
    }
  }
  settings: {}
  /**
   * Contains the UUID-hashed account and the UUID of the currently selected user
   */
  selectedUser: {
    /**
     * The UUID-hashed key of the currently selected account
     */
    account: string
    /**
     * The UUID of the currently selected player
     */
    profile: string
  }
}

@ExportService(UserServiceKey)
export default class UserService extends AbstractService implements IUserService {
  private refreshSkinRecord: Record<string, boolean> = {}

  private lookup = createDynamicThrottle(lookup, (uuid, options = {}) => (options.api ?? PROFILE_API_MOJANG).profile, 2400)

  private validate = createDynamicThrottle(validate, ({ accessToken }, api) => (api ?? AUTH_API_MOJANG).hostName, 2400)

  private userFile = new MappedFile<UserSchema>(this.getPath('user.json'), new BufferJsonSerializer(UserSchema))

  constructor(app: LauncherApp) {
    super(app)
    this.storeManager.subscribeAll([
      'userProfileAdd',
      'userProfileRemove',
      'userProfileUpdate',
      'userGameProfileSelect',
      'authService',
      'profileService',
      'userInvalidate',
      'authServiceRemove',
      'profileServiceRemove',
    ], async () => {
      await this.userFile.write(this.state.user)
    })
  }

  async initialize() {
    const data = await this.userFile.read()
    const result: UserSchema = {
      authServices: {},
      profileServices: {},
      users: {},
      selectedUser: {
        id: '',
        profile: '',
      },
      clientToken: '',
    }
    const mcdb = await this.getMinecraftAuthDb()
    fitMinecraftLauncherProfileData(result, data, mcdb)
    this.log(`Load ${Object.keys(result.users).length} users`)
    if (!result.clientToken) {
      result.clientToken = v4().replace(/-/g, '')
    }
    this.commit('userSnapshot', result)

    this.refreshUser()
    if (this.state.user.selectedUser.id === '' && Object.keys(this.state.user.users).length > 0) {
      const [userId, user] = Object.entries(this.state.user.users)[0]
      this.switchUserProfile({
        userId,
        profileId: user.selectedProfile,
      })
    }
  }

  async getMinecraftAuthDb() {
    const data: LauncherProfile = await readJSON(this.getMinecraftPath('launcher_profile.json')).catch(() => ({}))
    return data
  }

  /**
   * Logout and clear current cache.
   */
  @Singleton()
  async logout() {
    const user = this.getters.user
    if (this.getters.accessTokenValid) {
      if (user.authService !== 'offline') {
        await invalidate({
          accessToken: user.accessToken,
          clientToken: this.state.user.clientToken,
        }, this.getters.authService)
      }
    }
    this.commit('userInvalidate')
  }

  /**
   * Check current ip location and determine wether we need to validate user identity by response challenge.
   *
   * See `getChallenges` and `submitChallenges`
   */
  @Singleton()
  async checkLocation() {
    if (!this.getters.accessTokenValid) return true
    const user = this.getters.user
    if (user.authService !== 'mojang') return true
    try {
      const result = await checkLocation(user.accessToken)
      this.commit('userSecurity', result)
      return result
    } catch (e) {
      if (e.error === 'ForbiddenOperationException' && e.errorMessage === 'Current IP is not secured') {
        this.commit('userSecurity', false)
        return false
      }
      throw e
    }
  }

  /**
   * Get all the user set challenges for security reasons.
   */
  async getChallenges() {
    if (!this.getters.accessTokenValid) return []
    const user = this.getters.user
    if (user.profileService !== 'mojang') return []
    return getChallenges(user.accessToken)
  }

  async submitChallenges(responses: MojangChallengeResponse[]) {
    if (!this.getters.accessTokenValid) throw new Error('Cannot submit challenge if not logined')
    const user = this.getters.user
    if (user.authService !== 'mojang') throw new Error('Cannot sumit challenge if login mode is not mojang!')
    if (!(responses instanceof Array)) throw new Error('Expect responses Array!')
    const result = await responseChallenges(user.accessToken, responses)
    this.commit('userSecurity', true)
    return result
  }

  /**
   * Refresh the user auth status
   */
  @Singleton()
  async refreshStatus() {
    const user = this.getters.user

    if (!this.getters.offline) {
      const valid = await this.validate({
        accessToken: user.accessToken,
        clientToken: this.state.user.clientToken,
      }, this.getters.authService).catch((e) => {
        this.error(e)
        return false
      })

      this.log(`Validate ${user.authService} user access token: ${valid ? 'valid' : 'invalid'}`)

      if (valid) {
        this.checkLocation()
        return
      }
      try {
        const result = await refresh({
          accessToken: user.accessToken,
          clientToken: this.state.user.clientToken,
        }, this.getters.authService)
        this.log(`Refreshed user access token for user: ${user.id}`)
        this.commit('userProfileUpdate', {
          id: user.id,
          accessToken: result.accessToken,
          // profiles: result.availableProfiles,
          profiles: [],

          selectedProfile: undefined,
        })
        this.checkLocation()
      } catch (e) {
        this.error(e)
        this.warn(`Invalid current user ${user.id} accessToken!`)
        this.commit('userInvalidate')
      }
    } else {
      this.log(`Current user ${user.id} is offline. Skip to refresh credential.`)
    }
  }

  /**
   * Refresh current skin status
   */
  @Singleton(function (this: AbstractService, o: RefreshSkinOptions = {}) {
    const {
      gameProfileId = this.state.user.selectedUser.profile,
      userId = this.state.user.selectedUser.id,
    } = o ?? {}
    return `${userId}[${gameProfileId}]`
  })
  async refreshSkin(refreshSkinOptions: RefreshSkinOptions = {}) {
    const {
      gameProfileId = this.state.user.selectedUser.profile,
      userId = this.state.user.selectedUser.id,
      force,
    } = refreshSkinOptions ?? {}
    const user = this.state.user.users[userId]
    const gameProfile = user.profiles[gameProfileId]
    // if no game profile (maybe not logined), return
    if (gameProfile.name === '') return
    // if user doesn't have a valid access token, return
    if (!this.getters.accessTokenValid) return

    const userAndProfileId = `${userId}[${gameProfileId}]`
    const refreshed = this.refreshSkinRecord[userAndProfileId]

    // skip if we have refreshed
    if (refreshed && !force) return

    const { id, name } = gameProfile
    try {
      let profile: GameProfile
      const api = this.state.user.profileServices[user.profileService]
      const compatible = user.profileService === user.authService
      this.log(`Refresh skin for user ${gameProfile.name} in ${user.profileService} service ${compatible ? 'compatiblely' : 'incompatiblely'}`)

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
      this.refreshSkinRecord[userAndProfileId] = true
      if (skin) {
        this.log(`Update the skin for user ${gameProfile.name} in ${user.profileService} service`)
        this.commit('gameProfile', {
          userId: user.id,
          profile: {
            ...gameProfile,
            textures: { ...(textures?.textures || {}), SKIN: skin },
          },
        })
      } else {
        this.log(`The user ${gameProfile.name} in ${user.profileService} does not have skin!`)
      }
    } catch (e) {
      this.warn(`Cannot refresh the skin data for user ${name}(${id}) in ${user.profileService}`)
      this.warn(JSON.stringify(e))
    }
  }

  /**
   * Upload the skin to server. If the userId and profileId is not assigned,
   * it will use the selected user and selected profile.
   *
   * Notice that this operation might fail if the user is not authorized (accessToken is not valid).
   * If that happened, please let user refresh it credential or relogin.
   */
  async uploadSkin(options: UploadSkinOptions) {
    requireObject(options)
    requireNonnull(options.url)
    if (typeof options.slim !== 'boolean') options.slim = false

    const {
      gameProfileId = this.state.user.selectedUser.profile,
      userId = this.state.user.selectedUser.id,
      url,
      slim,
    } = options
    const user = this.state.user.users[userId]
    const gameProfile = user.profiles[gameProfileId]

    const { protocol } = new URL(url)
    let data: Buffer | undefined
    let skinUrl = ''
    if (protocol === 'file:') {
      data = await readFile(url)
    } else if (protocol === 'https:' || protocol === 'http:') {
      skinUrl = url
    } else {
      throw new Error('Unknown url protocol! Require a file or http/https protocol!')
    }

    this.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)
    return setTexture({
      uuid: gameProfile.id,
      accessToken: user.accessToken,
      type: 'skin',
      texture: {
        metadata: {
          model: slim ? 'slim' : 'steve',
        },
        url: skinUrl,
        data,
      },
    }, this.getters.profileService)
  }

  /**
   * Save the skin to the disk.
   */
  async saveSkin(options: { url: string; path: string }) {
    requireObject(options)
    requireString(options.url)
    requireString(options.path)
    const { path, url } = options
    await new DownloadTask({ url, destination: path, ...this.networkManager.getDownloadBaseOptions() }).startAndWait()
  }

  /**
   * Refresh the current user login status
   */
  @Singleton()
  async refreshUser() {
    if (!this.getters.accessTokenValid) return
    await this.refreshStatus().catch(_ => _)
  }

  /**
  * Switch user account.
  */
  async switchUserProfile(payload: {
    /**
     * The user id of the user
     */
    userId: string
    /**
     * The game profile id of the user
     */
    profileId: string
  }) {
    requireObject(payload)
    requireString(payload.userId)
    requireString(payload.profileId)

    if (payload.profileId === this.state.user.selectedUser.profile &&
      payload.userId === this.state.user.selectedUser.id) {
      return
    }

    this.log(`Switch game profile ${payload.userId} ${payload.profileId}`)
    this.commit('userGameProfileSelect', payload)
    await this.refreshUser()
  }

  @Singleton((id: string) => id)
  async removeUserProfile(userId: string) {
    requireString(userId)
    if (this.state.user.selectedUser.id === userId) {
      const user = Object.values(this.state.user.users).find((u) => !!u.selectedProfile)
      if (!user) {
        this.warn(`No valid user after remove user profile ${userId}!`)
      } else {
        const userId = user.id
        const profileId = user.selectedProfile
        this.log(`Switch game profile ${userId} ${profileId}`)
        this.commit('userGameProfileSelect', { userId, profileId })
      }
    }
    this.commit('userProfileRemove', userId)
  }

  @Singleton()
  async loginMicrosoft(options: LoginMicrosoftOptions) {
    const { oauthCode, microsoftEmailAddress } = options

    const req = this.app.networkManager.request
    const tokenResult = await this.credentialManager.aquireMicrosoftToken({ username: microsoftEmailAddress, code: oauthCode })
    const oauthAccessToken = tokenResult!.accessToken
    const { xstsResponse, xboxGameProfile } = await aquireXBoxToken(req, oauthAccessToken)

    const mcResponse = await loginMinecraftWithXBox(req, xstsResponse.DisplayClaims.xui[0].uhs, xstsResponse.Token)

    const ownershipResponse = await checkGameOwnership(req, mcResponse.access_token)
    const ownGame = ownershipResponse.items.length > 0

    if (ownGame) {
      const gameProfileResponse = await getGameProfile(req, mcResponse.access_token)
      const gameProfiles: GameProfileAndTexture[] = [{
        id: gameProfileResponse.id,
        name: gameProfileResponse.name,
        textures: {
          SKIN: {
            url: gameProfileResponse.skins[0].url,
            metadata: { model: gameProfileResponse.skins[0].variant === 'CLASSIC' ? 'steve' : 'slim' },
          },
          CAPE: gameProfileResponse.capes.length > 0 ? {
            url: gameProfileResponse.capes[0].url,
          } : undefined,
        },
      }]
      return {
        userId: mcResponse.username,
        accessToken: mcResponse.access_token,
        gameProfiles,
        selectedProfile: gameProfiles[0],
        avatar: xboxGameProfile.profileUsers[0].settings.find(v => v.id === 'PublicGamerpic')?.value,
      }
    }

    return {
      userId: mcResponse.username,
      accessToken: mcResponse.access_token,
      gameProfiles: [],
      selectedProfile: undefined,
      avatar: xboxGameProfile.profileUsers[0].settings.find(v => v.id === 'PublicGamerpic')?.value,
    }
  }

  /**
   * Login the user by current login mode. Refresh the skin and account information.
   */
  async login(options: LoginOptions) {
    requireObject(options)
    requireString(options.username)

    let {
      username,
      password,
      authService = password ? 'mojang' : 'offline',
      profileService = 'mojang',
    } = options

    const selectedUserProfile = this.getters.user
    const usingAuthService = this.state.user.authServices[authService]
    password = password ?? ''

    if (authService !== 'offline' && authService !== 'microsoft' && !usingAuthService) {
      throw new Error(`Cannot find auth service named ${authService}`)
    }

    this.log(`Try login username: ${username} ${password ? 'with password' : 'without password'} to auth ${authService} and profile ${profileService}`)

    let userId: string
    let accessToken: string
    let availableProfiles: GameProfile[]
    let selectedProfile: GameProfile | undefined
    let avatar: string | undefined

    if (authService !== 'offline' && authService !== 'microsoft') {
      this.app.emit('user-login', usingAuthService.hostName)
    } else {
      this.app.emit('user-login', authService)
    }

    if (authService === 'offline') {
      const result = offline(username)
      userId = result.user!.id
      accessToken = result.accessToken
      availableProfiles = result.availableProfiles
      selectedProfile = result.selectedProfile
    } else if (authService === 'microsoft') {
      const result = await this.loginMicrosoft({ microsoftEmailAddress: username })
      userId = result.userId
      accessToken = result.accessToken
      availableProfiles = result.gameProfiles
      selectedProfile = result.selectedProfile
      avatar = result.avatar
    } else {
      const result = await login({
        username,
        password,
        requestUser: true,
        clientToken: this.state.user.clientToken,
      }, usingAuthService).catch((e) => {
        if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
          throw Exception.from(e, { type: 'loginInternetNotConnected' })
        } else if (e.error === 'ForbiddenOperationException' &&
          e.errorMessage === 'Invalid credentials. Invalid username or password.') {
          throw Exception.from(e, { type: 'loginInvalidCredentials' })
        } else if (e.error === 'ForbiddenOperationException' &&
          e.errorMessage === 'Invalid credential information.') {
          throw Exception.from(e, { type: 'loginInvalidCredentials' })
        }
        throw Exception.from(e, { type: 'loginGeneral' })
      })
      userId = result.user!.id
      accessToken = result.accessToken
      availableProfiles = result.availableProfiles
      selectedProfile = result.selectedProfile
    }

    // this.refreshedSkin = false;

    if (!this.state.user.users[userId]) {
      this.log(`New user added ${userId}`)

      this.commit('userProfileAdd', {
        id: userId,
        accessToken,
        profiles: availableProfiles,

        username,
        profileService,
        authService,

        selectedProfile: selectedProfile ? selectedProfile.id : '',
        avatar,
      })
    } else {
      this.log(`Found existed user ${userId}. Update the profiles of it`)
      this.commit('userProfileUpdate', {
        id: userId,
        accessToken,
        profiles: availableProfiles,
        selectedProfile: selectedProfile ? selectedProfile.id : '',
      })
    }
    if ((!this.state.user.selectedUser.id || options.selectProfile) && selectedProfile) {
      this.log(`Select the game profile ${selectedProfile.id} in user ${userId}`)
      this.commit('userGameProfileSelect', {
        profileId: selectedProfile.id,
        userId,
      })
    } else {
      this.log(`No game profiles found for user ${username} in ${authService}, ${profileService} services.`)
    }
  }
}
