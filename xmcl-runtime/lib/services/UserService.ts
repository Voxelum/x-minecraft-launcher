import { DownloadTask } from '@xmcl/installer'
import {
  Exception, GameProfileAndTexture, LoginMicrosoftOptions, LoginOptions,
  RefreshSkinOptions,
  UploadSkinOptions, UserException, UserSchema, UserService as IUserService, UserServiceKey, UserState,
} from '@xmcl/runtime-api'
import { AUTH_API_MOJANG, checkLocation, GameProfile, getChallenges, getTextures, invalidate, login, lookup, lookupByName, MojangChallengeResponse, offline, PROFILE_API_MOJANG, refresh, responseChallenges, setTexture, validate } from '@xmcl/user'
import { readFile, readJSON } from 'fs-extra'
import { basename } from 'path'
import { URL } from 'url'
import { v4 } from 'uuid'
import LauncherApp from '../app/LauncherApp'
import { acquireXBoxToken, changeAccountSkin, checkGameOwnership, getGameProfile, loginMinecraftWithXBox } from '../entities/user'
import { requireNonnull, requireObject, requireString } from '../util/object'
import { createSafeFile } from '../util/persistance'
import { createDynamicThrottle } from '../util/trafficAgent'
import { fitMinecraftLauncherProfileData } from '../util/userData'
import DiagnoseService from './DiagnoseService'
import { ExportService, Inject, Singleton, StatefulService } from './Service'

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
export default class UserService extends StatefulService<UserState> implements IUserService {
  createState() { return new UserState() }

  private refreshSkinRecord: Record<string, boolean> = {}

  private lookup = createDynamicThrottle(lookup, (uuid, options = {}) => (options.api ?? PROFILE_API_MOJANG).profile, 2400)

  private validate = createDynamicThrottle(validate, ({ accessToken }, api) => (api ?? AUTH_API_MOJANG).hostName, 2400)

  private userFile = createSafeFile(this.getPath('user.json'), UserSchema, this)

  constructor(app: LauncherApp,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService) {
    super(app, async () => {
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
      this.state.userSnapshot(result)

      this.refreshUser()
      if (this.state.selectedUser.id === '' && Object.keys(this.state.users).length > 0) {
        const [userId, user] = Object.entries(this.state.users)[0]
        this.switchUserProfile({
          userId,
          profileId: user.selectedProfile,
        })
      }
    })
    this.storeManager.subscribeAll([
      'userProfileAdd',
      'userProfileRemove',
      'userProfileUpdate',
      'userGameProfileSelect',
      'authServiceSet',
      'profileServiceSet',
      'userInvalidate',
      'authServiceRemove',
      'profileServiceRemove',
    ], async () => {
      await this.userFile.write(this.state)
    })
    this.storeManager.subscribeAll(['userProfileUpdate', 'userGameProfileSelect', 'userInvalidate'], async () => {
      const user = this.state.user
      if (!this.state.isAccessTokenValid) {
        this.diagnoseService.report({ userNotLogined: [{ authService: user.authService, account: user.username }] })
      } else {
        this.diagnoseService.report({ userNotLogined: [] })
      }
    })
  }

  async getMinecraftAuthDb() {
    const data: LauncherProfile = await readJSON(this.getMinecraftPath('launcher_profile.json')).catch(() => ({}))
    return data
  }

  @Singleton()
  async logout() {
    const user = this.state.user
    if (this.state.isAccessTokenValid) {
      if (user.authService !== 'offline') {
        await invalidate({
          accessToken: user.accessToken,
          clientToken: this.state.clientToken,
        }, this.state.authService)
      }
    }
    this.state.userInvalidate()
  }

  @Singleton()
  async checkLocation() {
    const user = this.state.user
    if (!this.state.isAccessTokenValid) return true
    if (user.authService !== 'mojang') return true
    function isCommonError(e: any): e is { error: string; errorMessage: string } {
      return e && typeof e === 'object' && typeof e.error === 'string' && typeof e.errorMessage === 'string'
    }
    try {
      const result = await checkLocation(user.accessToken)
      this.state.userSecurity(result)
      return result
    } catch (e) {
      if (isCommonError(e) && e.error === 'ForbiddenOperationException' && e.errorMessage === 'Current IP is not secured') {
        this.state.userSecurity(false)
        return false
      }
      throw e
    }
  }

  async getChallenges() {
    if (!this.state.isAccessTokenValid) return []
    const user = this.state.user
    if (user.profileService !== 'mojang') return []
    return getChallenges(user.accessToken)
  }

  async submitChallenges(responses: MojangChallengeResponse[]) {
    if (!this.state.isAccessTokenValid) throw new Error('Cannot submit challenge if not logined')
    const user = this.state.user
    if (user.authService !== 'mojang') throw new Error('Cannot submit challenge if login mode is not mojang!')
    if (!(responses instanceof Array)) throw new Error('Expect responses Array!')
    const result = await responseChallenges(user.accessToken, responses)
    this.state.userSecurity(true)
    return result
  }

  /**
   * Refresh the user auth status
   */
  @Singleton()
  async refreshStatus() {
    const user = this.state.user

    if (this.state.isYggdrasilService) {
      const valid = await this.validate({
        accessToken: user.accessToken,
        clientToken: this.state.clientToken,
      }, this.state.authService).catch((e) => {
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
          clientToken: this.state.clientToken,
        }, this.state.authService)
        this.log(`Refreshed user access token for user: ${user.id}`)
        this.state.userProfileUpdate({
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
        this.state.userInvalidate()
      }
    } else {
      this.log(`Current user ${user.id} is not YggdrasilService. Skip to refresh credential.`)
    }
  }

  /**
   * Refresh current skin status
   */
  @Singleton<StatefulService<UserState>>(function (this: StatefulService<UserState>, o: RefreshSkinOptions = {}) {
    const {
      gameProfileId = this.state.selectedUser.profile,
      userId = this.state.selectedUser.id,
    } = o ?? {}
    return `${userId}[${gameProfileId}]`
  })
  async refreshSkin(refreshSkinOptions: RefreshSkinOptions = {}) {
    const {
      gameProfileId = this.state.selectedUser.profile,
      userId = this.state.selectedUser.id,
      force,
    } = refreshSkinOptions ?? {}
    const user = this.state.users[userId]
    const gameProfile = user.profiles[gameProfileId]
    // if no game profile (maybe not logined), return
    if (gameProfile.name === '') return
    // if user doesn't have a valid access token, return
    if (!this.state.isAccessTokenValid) return

    const userAndProfileId = `${userId}[${gameProfileId}]`
    const refreshed = this.refreshSkinRecord[userAndProfileId]

    // skip if we have refreshed
    if (refreshed && !force) return

    const { id, name } = gameProfile
    if (user.authService === 'microsoft') {
      const profile = await getGameProfile(this.networkManager.request, user.accessToken)
      this.state.gameProfileUpdate({
        userId,
        profile: {
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
        },
      })
      return
    }
    try {
      let profile: GameProfile
      const api = this.state.profileServices[user.profileService]
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
        this.state.gameProfileUpdate({
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
      gameProfileId = this.state.selectedUser.profile,
      userId = this.state.selectedUser.id,
      url,
      slim,
    } = options
    const user = this.state.users[userId]
    const gameProfile = user.profiles[gameProfileId]

    const normalizedUrl = url.replace('image:', 'file:')
    const { protocol } = new URL(normalizedUrl)
    let data: Buffer | undefined
    let skinUrl = ''
    if (protocol === 'file:') {
      data = await readFile(normalizedUrl.replace('file://', ''))
    } else if (protocol === 'https:' || protocol === 'http:') {
      skinUrl = url
    } else {
      throw new Error('Unknown url protocol! Require a file or http/https protocol!')
    }

    this.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

    if (this.state.user.authService === 'microsoft') {
      const dataOrUrl = skinUrl || data
      const profile = await changeAccountSkin(this.app.networkManager.request, user.accessToken, basename(normalizedUrl.replace('file://', '')), dataOrUrl!, slim ? 'slim' : 'classic')
      this.state.gameProfileUpdate({
        userId,
        profile: {
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
        },
      })
      return
    }

    await setTexture({
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
    }, this.state.profileService)
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
    if (!this.state.isAccessTokenValid) {
      return
    }
    await this.refreshStatus().catch(_ => _)
  }

  /**
  * Switch user account.
  */
  @Singleton()
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

    if (payload.profileId === this.state.selectedUser.profile &&
      payload.userId === this.state.selectedUser.id) {
      return
    }

    this.log(`Switch game profile ${payload.userId} ${payload.profileId}`)
    this.state.userGameProfileSelect(payload)
    await this.refreshUser()
  }

  @Singleton(id => id)
  async removeUserProfile(userId: string) {
    requireString(userId)
    if (this.state.selectedUser.id === userId) {
      const user = Object.values(this.state.users).find((u) => !!u.selectedProfile)
      if (!user) {
        this.warn(`No valid user after remove user profile ${userId}!`)
      } else {
        const userId = user.id
        const profileId = user.selectedProfile
        this.log(`Switch game profile ${userId} ${profileId}`)
        this.state.userGameProfileSelect({ userId, profileId })
      }
    }
    this.state.userProfileRemove(userId)
  }

  /**
   * Really the workaround to prevent login forever
   */
  async cancelMicrosoftLogin() {
    this.credentialManager.cancelMicrosoftTokenRequest()
  }

  @Singleton()
  async loginMicrosoft(options: LoginMicrosoftOptions) {
    const { oauthCode, microsoftEmailAddress } = options

    const req = this.app.networkManager.request
    const tokenResult = await this.credentialManager.acquireMicrosoftToken({ username: microsoftEmailAddress, code: oauthCode })
    const oauthAccessToken = tokenResult!.accessToken
    const { xstsResponse, xboxGameProfile } = await acquireXBoxToken(req, oauthAccessToken)

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
  @Singleton()
  async login(options: LoginOptions) {
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

    const selectedUserProfile = this.state.user
    const usingAuthService = this.state.authServices[authService]
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
      this.emit('user-login', usingAuthService.hostName)
    } else {
      this.emit('user-login', authService)
    }

    if (authService === 'offline') {
      const result = offline(username)
      userId = result.user!.id
      accessToken = result.accessToken
      availableProfiles = result.availableProfiles
      selectedProfile = result.selectedProfile
    } else if (authService === 'microsoft') {
      await this.cancelMicrosoftLogin()
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
        clientToken: this.state.clientToken,
      }, usingAuthService).catch((e) => {
        if (e.message && e.message.startsWith('getaddrinfo ENOTFOUND')) {
          throw new UserException({ type: 'loginInternetNotConnected' }, e.message)
        } else if (e.error === 'ForbiddenOperationException' &&
          e.errorMessage === 'Invalid credentials. Invalid username or password.') {
          throw new UserException({ type: 'loginInvalidCredentials' }, e.message)
        } else if (e.error === 'ForbiddenOperationException' &&
          e.errorMessage === 'Invalid credential information.') {
          throw new UserException({ type: 'loginInvalidCredentials' }, e.message)
        }
        throw new UserException({ type: 'loginGeneral' }, e.message)
      })
      userId = result.user!.id
      accessToken = result.accessToken
      availableProfiles = result.availableProfiles
      selectedProfile = result.selectedProfile
    }

    // this.refreshedSkin = false;

    if (!this.state.users[userId]) {
      this.log(`New user added ${userId}`)

      this.state.userProfileAdd({
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
      this.state.userProfileUpdate({
        id: userId,
        accessToken,
        profiles: availableProfiles,
        selectedProfile: selectedProfile ? selectedProfile.id : '',
      })
    }
    if ((!this.state.selectedUser.id || options.selectProfile) && selectedProfile) {
      this.log(`Select the game profile ${selectedProfile.id} in user ${userId}`)
      this.state.userGameProfileSelect({
        profileId: selectedProfile.id,
        userId,
      })
    } else {
      this.log(`No game profiles found for user ${username} in ${authService}, ${profileService} services.`)
    }
  }
}
