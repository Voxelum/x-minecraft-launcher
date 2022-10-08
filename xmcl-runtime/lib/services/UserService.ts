/* eslint-disable quotes */
import { DownloadTask } from '@xmcl/installer'
import {
  GameProfileAndTexture,
  LoginOptions,
  RefreshSkinOptions,
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
  login(options: LoginOptions): Promise<UserProfile>
  /**
   * Refresh the user profile
   */
  refresh(userProfile: UserProfile): Promise<UserProfile>
  getSkin(userProfile: UserProfile): Promise<UserProfile>
  setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, payload: SkinPayload): Promise<UserProfile>
}

@ExposeServiceKey(UserServiceKey)
export class UserService extends StatefulService<UserState> implements IUserService {
  private userFile = createSafeFile(this.getAppDataPath('user.json'), UserSchema, this, [this.getPath('user.json')])

  private registeredAccountSystem: Record<string, UserAccountSystem | undefined> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, UserServiceKey, () => new UserState(), async () => {
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
      this.refreshSkin()
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
  }

  @Lock('login')
  async login(options: LoginOptions): Promise<UserProfile> {
    const system = this.registeredAccountSystem[options.service]
    if (!system) {
      throw new Error()
    }
    const profile = await system.login(options)
    this.state.userProfile(profile)
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

  /**
   * Refresh current skin status
   */
  @Singleton<StatefulService<UserState>>(function (this: StatefulService<UserState>, o: RefreshSkinOptions = {}) {
    const {
      gameProfileId = this.state.user?.selectedProfile,
      userId = this.state.selectedUser.id,
    } = o ?? {}
    return `${userId}[${gameProfileId}]`
  })
  async refreshSkin(refreshSkinOptions: RefreshSkinOptions = {}) {
    const {
      userId = this.state.selectedUser.id,
    } = refreshSkinOptions ?? {}
    const user = this.state.users[userId]
    if (!user) {
      this.warn(`Skip to refresh user as not found. UserId=${userId}. All known user ids: [${Object.keys(this.state.users).join(', ')}]`)
      return
    }

    const sys = this.registeredAccountSystem[user.authService]
    if (sys) {
      const data = await sys.getSkin(user)
      this.state.userProfile(data)
    } else {
      this.warn(`Fail to find the user account system ${user.authService}`)
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

    const {
      gameProfileId,
      userId = this.state.selectedUser.id,
      skin,
      cape,
    } = options
    const user = this.state.users[userId]
    const gameProfile = user.profiles[gameProfileId || user.selectedProfile]

    const sys = this.registeredAccountSystem[user.authService]

    if (skin) {
      if (typeof skin.slim !== 'boolean') skin.slim = false
    }

    if (sys) {
      this.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

      await sys.setSkin(user, gameProfile, options)
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
  @Singleton()
  async refreshUser() {
    const user = this.state.user

    if (!user) {
      this.log('Skip refresh user status as the user is empty.')
      return
    }

    const authService = user.authService

    const system = this.registeredAccountSystem[authService]
    if (authService && system) {
      const newUser = await system.refresh(user)
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
        const profileId = user.selectedProfile
        this.log(`Switch game profile ${userId} ${profileId}`)
        this.state.userGameProfileSelect({ userId, profileId })
      }
    }
    this.state.userProfileRemove(userId)
  }

  abortLogin(): Promise<void> {
    throw new Error('Method not implemented.')
  }

  async getSupportedAccountSystems(): Promise<string[]> {
    return Object.keys(this.registeredAccountSystem).sort((a, b) => a === 'microsoft' ? -1 : b === 'microsoft' ? 1 : 0)
  }

  getAccountSystem(service: string) {
    return this.registeredAccountSystem[service]
  }
}
