/* eslint-disable quotes */
import { DownloadTask } from '@xmcl/installer'
import {
  GameProfileAndTexture,
  LoginOptions,
  SaveSkinOptions,
  SkinPayload,
  UploadSkinOptions,
  UserProfile,
  UserSchema,
  UserService as IUserService,
  UserServiceKey,
  UserState,
} from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { readJSON } from 'fs-extra'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { LauncherProfile } from '../entities/launchProfile'
import { requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { createSafeFile } from '../util/persistance'
import { fitMinecraftLauncherProfileData } from '../util/userData'
import { ExposeServiceKey, Lock, Singleton, StatefulService } from './Service'

export interface UserAccountSystem {
  getYggdrasilHost?(): string
  login(options: LoginOptions, abortSignal: AbortSignal): Promise<UserProfile>
  /**
   * Refresh the user profile
   */
  refresh(userProfile: UserProfile, signal: AbortSignal): Promise<UserProfile>
  /**
   * Set skin to the game profile. This should also update the game profile skin data and return the new user profile.
   */
  setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, payload: SkinPayload, signal: AbortSignal): Promise<UserProfile>
}

@ExposeServiceKey(UserServiceKey)
export class UserService extends StatefulService<UserState> implements IUserService {
  private userFile = createSafeFile(this.getAppDataPath('user.json'), UserSchema, this, [this.getPath('user.json')])
  private loginController: AbortController | undefined
  private refreshController: AbortController | undefined
  private setSkinController: AbortController | undefined

  private registeredAccountSystem: Record<string, UserAccountSystem | undefined> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, () => new UserState(), async () => {
      const data = await this.userFile.read()
      const result: UserSchema = {
        users: {},
        selectedUser: {
          id: '',
        },
        clientToken: '',
      }
      const mcdb = await this.getMinecraftAuthDb()
      fitMinecraftLauncherProfileData(result, data, mcdb)
      this.log(`Load ${Object.keys(result.users).length} users`)
      if (!result.clientToken) {
        result.clientToken = randomUUID().replace(/-/g, '')
      }
      for (const user of Object.values(result.users)) {
        if (typeof user.expiredAt === 'undefined') {
          user.expiredAt = -1
        }
      }
      this.state.userSnapshot(result)

      this.refreshUser()
      if (this.state.selectedUser.id === '' && Object.keys(this.state.users).length > 0) {
        const [userId, user] = Object.entries(this.state.users)[0]
        this.selectUser(userId)
      }
    })

    this.storeManager.subscribeAll([
      'userProfile',
      'userProfileRemove',
      'userGameProfileSelect',
      'userInvalidate',
    ], async () => {
      const userData: UserSchema = {
        users: this.state.users,
        selectedUser: this.state.selectedUser,
        clientToken: this.state.clientToken,
      }
      await this.userFile.write(userData)
    })

    app.protocol.registerHandler('authlib-injector', ({ request, response }) => {
      if (request.url.pathname.startsWith('yggdrasil-server:')) {
        const serverUrl = decodeURIComponent(request.url.pathname.substring('yggdrasil-server:'.length))
        const parsed = new URL(serverUrl)
        const domain = parsed.host
        // const userService = this.serviceManager.get(YggdrasilUserService)
        // userService.registerFirstPartyApi(domain, {
        //   hostName: serverUrl,
        //   authenticate: '/authserver/authenticate',
        //   refresh: '/authserver/refresh',
        //   validate: '/authserver/validate',
        //   invalidate: '/authserver/invalidate',
        //   signout: '/authserver/signout',
        // }, {
        //   profile: `${serverUrl}/sessionserver/session/minecraft/profile/\${uuid}`,
        //   profileByName: `${serverUrl}/users/profiles/minecraft/\${name}`,
        //   texture: `${serverUrl}/user/profile/\${uuid}/\${type}`,
        // })
        // userService.emit('auth-profile-added', domain)
        // this.log(`Import the url ${url} as authlib-injector profile ${domain}`)
        response.status = 200
      }
    })
  }

  @Lock('login')
  async login(options: LoginOptions): Promise<UserProfile> {
    const system = this.registeredAccountSystem[options.service]
    if (!system) {
      throw new Error()
    }
    this.loginController = new AbortController()
    const profile = await system.login(options, this.loginController.signal)
      .finally(() => { this.loginController = undefined })
    this.state.userProfile(profile)
    this.state.userSelect(profile.id)
    return profile
  }

  async setUserProfile(userProfile: UserProfile): Promise<void> {
    this.state.userProfile(userProfile)
  }

  registerAccountSystem(name: string, system: UserAccountSystem) {
    this.registeredAccountSystem[name] = system
  }

  async getMinecraftAuthDb() {
    const data: LauncherProfile = await readJSON(this.getMinecraftPath('launcher_profile.json')).catch(() => ({}))
    return data
  }

  @Lock('uploadSkin')
  async uploadSkin(options: UploadSkinOptions) {
    requireObject(options)

    const {
      gameProfileId,
      userId = this.state.selectedUser.id,
      skin,
    } = options
    const user = this.state.users[userId]
    const gameProfile = user.profiles[gameProfileId || user.selectedProfile]

    const sys = this.registeredAccountSystem[user.authService]

    if (skin) {
      if (typeof skin.slim !== 'boolean') skin.slim = false
    }

    if (sys) {
      this.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

      this.setSkinController = new AbortController()
      const data = await sys.setSkin(user, gameProfile, options, this.setSkinController.signal).finally(() => {
        this.setSkinController = undefined
      })
      this.state.userProfile(data)
    } else {
      this.warn(`Does not found system named ${user.authService}. Skip to set skin.`)
    }
  }

  /**
   * Save the skin to the disk.
   */
  async saveSkin(options: SaveSkinOptions) {
    requireObject(options)
    requireString(options.url)
    requireString(options.path)
    const { path, url } = options
    await new DownloadTask({ url, destination: path, ...this.networkManager.getDownloadBaseOptions() }).startAndWait()
  }

  /**
   * Refresh the current user login status
   */
  @Lock('refreshUser')
  async refreshUser() {
    const user = this.state.user

    if (!user) {
      this.log('Skip refresh user status as the user is empty.')
      return
    }

    const authService = user.authService

    const system = this.registeredAccountSystem[authService]
    if (authService && system) {
      this.refreshController = new AbortController()
      const newUser = await system.refresh(user, this.refreshController.signal).finally(() => {
        this.refreshController = undefined
      })
      this.state.userProfile(newUser)
    } else {
      this.log(`User auth service ${authService} not found.`)
    }
  }

  /**
  * Switch user account.
  */
  @Lock('selectUser')
  async selectUser(userId: string) {
    requireString(userId)

    if (userId === this.state.selectedUser.id) {
      return
    }

    this.log(`Switch game profile ${this.state.selectedUser.id}->${userId}`)
    this.state.userSelect(userId)
    await this.refreshUser()
  }

  @Lock('selectGameProfile')
  async selectGameProfile(profileId: string) {
    requireString(profileId)

    const user = this.state.user
    if (!user) {
      this.warn(`No valid user`)
      return
    }

    this.state.userGameProfileSelect({ userId: this.state.selectedUser.id, profileId: profileId })
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
        this.log(`Switch game profile ${userId}`)
        this.state.userSelect(userId)
      }
    }
    this.state.userProfileRemove(userId)
  }

  async getOfficialUserProfile(): Promise<UserProfile | undefined> {
    const official = Object.values(this.state.users).find(u => u.authService === 'microsoft')
    if (official) {
      const controller = new AbortController()
      await this.registeredAccountSystem.microsoft?.refresh(official, controller.signal)
      return official
    }
    return undefined
  }

  async abortLogin(): Promise<void> {
    this.loginController?.abort()
  }

  async abortRefresh() {
    this.refreshController?.abort()
  }

  async getSupportedAccountSystems(): Promise<string[]> {
    return Object.keys(this.registeredAccountSystem).sort((a, b) => a === 'microsoft' ? -1 : b === 'microsoft' ? 1 : 0)
  }

  getAccountSystem(service: string) {
    return this.registeredAccountSystem[service]
  }
}
