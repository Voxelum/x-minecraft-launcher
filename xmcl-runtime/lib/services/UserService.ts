/* eslint-disable quotes */
import { DownloadTask } from '@xmcl/installer'
import {
  GameProfileAndTexture,
  RefreshSkinOptions,
  SaveSkinOptions,
  SwitchProfileOptions,
  UploadSkinOptions, UserProfile, UserSchema, UserService as IUserService, UserServiceKey, UserState,
} from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { readJSON } from 'fs-extra'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { LauncherProfile } from '../entities/launchProfile'
import { normalizeSkinData } from '../entities/user'
import { requireNonnull, requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { createSafeFile } from '../util/persistance'
import { fitMinecraftLauncherProfileData } from '../util/userData'
import { BaseService } from './BaseService'
import { Singleton, StatefulService } from './Service'

export interface UserAccountSystem {
  name: string
  refresh(userProfile: UserProfile, clientToken: string): Promise<UserProfile>
  getSkin(userProfile: UserProfile): Promise<UserProfile>
  setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, skin: string | Buffer, slim: boolean): Promise<UserProfile>
}

export class UserService extends StatefulService<UserState> implements IUserService {
  private userFile = createSafeFile(this.getAppDataPath('user.json'), UserSchema, this, [this.getPath('user.json')])

  private registeredAccountSystem: Record<string, UserAccountSystem> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp, @Inject(BaseService) baseService: BaseService) {
    super(app, UserServiceKey, () => new UserState(), async () => {
      const data = await this.userFile.read()
      const result: UserSchema = {
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
        this.switchUserProfile({
          userId,
          profileId: user.selectedProfile,
        })
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

    this.storeManager.subscribeAll(['userGameProfileSelect', 'userInvalidate'], async () => {
      // const user = this.state.user
      // if (!this.state.isAccessTokenValid) {
      //   this.diagnoseService.report({ userNotLogined: [{ authService: user.authService, account: user.username }] })
      // } else {
      //   this.diagnoseService.report({ userNotLogined: [] })
      // }
    })
  }

  async setUserProfile(userProfile: UserProfile): Promise<void> {
  }

  registerAccountSystem(system: UserAccountSystem) {
    this.registeredAccountSystem[system.name] = system
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
    if (!user) {
      this.warn(`Skip to refresh user as not found. UserId=${userId}. All known user ids: [${Object.keys(this.state.users).join(', ')}]`)
      return
    }

    const sys = this.registeredAccountSystem[user.authService]
    if (sys) {
      const data = await sys.getSkin(user)
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

    const sys = this.registeredAccountSystem[user.authService]
    const normalizedUrl = url.replace('image:', 'file:')
    const dataOrUrl = await normalizeSkinData(normalizedUrl)

    if (sys) {
      this.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)
      await sys.setSkin(user, gameProfile, dataOrUrl, slim)
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

    if (authService && this.registeredAccountSystem[authService]) {
      const system = this.registeredAccountSystem[authService]
      const newUser = await system.refresh(user, this.state.clientToken)
      this.state.userProfile(newUser)
    } else {
      this.log(`User auth service ${authService} not found.`)
    }
  }

  /**
  * Switch user account.
  */
  @Singleton()
  async switchUserProfile(options: SwitchProfileOptions) {
    requireObject(options)
    requireString(options.userId)
    requireString(options.profileId)

    if (options.profileId === this.state.selectedUser.profile &&
      options.userId === this.state.selectedUser.id) {
      return
    }

    this.log(`Switch game profile ${options.userId} ${options.profileId}`)
    this.state.userGameProfileSelect(options)
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
}
