/* eslint-disable quotes */
import { DownloadTask } from '@xmcl/installer'
import {
  AUTHORITY_MICROSOFT,
  UserService as IUserService,
  LoginOptions,
  MutableState,
  SaveSkinOptions, UploadSkinOptions,
  UserException,
  UserProfile,
  UserSchema,
  UserServiceKey,
  UserState,
} from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { UserAccountSystem } from '../accountSystems/AccountSystem'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { kDownloadOptions } from '../entities/downloadOptions'
import { PathResolver, kGameDataPath } from '../entities/gameDataPath'
import { UserTokenStorage, kUserTokenStorage } from '../entities/userTokenStore'
import { requireObject, requireString } from '../util/object'
import { Inject } from '../util/objectRegistry'
import { SafeFile, createSafeFile } from '../util/persistance'
import { ensureLauncherProfile, preprocessUserData } from '../util/userData'
import { ExposeServiceKey, Lock, Singleton, StatefulService } from './Service'
import { YggdrasilService } from './YggdrasilService'

@ExposeServiceKey(UserServiceKey)
export class UserService extends StatefulService<UserState> implements IUserService {
  private userFile: SafeFile<UserSchema>
  private saveUserFile = debounce(async () => {
    const userData = {
      users: this.state.users,
    }
    await this.userFile.write(userData)
  }, 1000)

  private loginController: AbortController | undefined
  private refreshController: AbortController | undefined
  private setSkinController: AbortController | undefined
  private accountSystems: Record<string, UserAccountSystem | undefined> = {}
  private mojangSelectedUserId = ''

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kUserTokenStorage) private tokenStorage: UserTokenStorage,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(YggdrasilService) private yggdrasilAccountSystem: YggdrasilService) {
    super(app, () => new UserState(), async () => {
      const data = await this.userFile.read()
      const userData = {
        users: {},
        yggdrasilServices: [],
      }

      // This will fill the user data
      const { mojangSelectedUserId } = await preprocessUserData(userData, data, this.getMinecraftPath('launcher_profiles.json'), tokenStorage)
      this.mojangSelectedUserId = mojangSelectedUserId
      // Ensure the launcher profile
      await ensureLauncherProfile(this.getPath())

      this.log(`Load ${Object.keys(userData.users).length} users`)

      this.state.userData(userData)

      // Refresh all users
      Promise.all(Object.values(userData.users as Record<string, UserProfile>).map((user) => {
        return this.refreshUser(user.id).catch((e) => {
          this.log(`Failed to refresh user ${user.id}`, e)
        })
      }))
    })

    this.userFile = createSafeFile(this.getAppDataPath('user.json'), UserSchema, this, [this.getPath('user.json')])
    this.state.subscribeAll(() => {
      this.saveUserFile()
    })
  }

  async removeUserGameProfile(userProfile: UserProfile, gameProfileId: string): Promise<void> {
    if (this.state.users[userProfile.id]) {
      delete this.state.users[userProfile.id].profiles[gameProfileId]
      this.state.userProfile(this.state.users[userProfile.id])
    }
  }

  async getUserState(): Promise<MutableState<UserState>> {
    await this.initialize()
    return this.state
  }

  async getMojangSelectedUser(): Promise<string> {
    return this.mojangSelectedUserId
  }

  @Lock('login')
  async login(options: LoginOptions): Promise<UserProfile> {
    const system = this.accountSystems[options.authority] || this.yggdrasilAccountSystem.yggdrasilAccountSystem

    this.loginController = new AbortController()

    const profile = await system.login(options, this.loginController.signal)
      .finally(() => { this.loginController = undefined })

    this.state.userProfile(profile)
    return profile
  }

  registerAccountSystem(authority: string, system: UserAccountSystem) {
    this.accountSystems[authority] = system
  }

  @Lock('uploadSkin')
  async uploadSkin(options: UploadSkinOptions) {
    requireObject(options)

    const {
      gameProfileId,
      userId,
      skin,
    } = options
    const user = this.state.users[userId]
    const gameProfile = user.profiles[gameProfileId || user.selectedProfile]

    const sys = this.accountSystems[user.authority] || this.yggdrasilAccountSystem.yggdrasilAccountSystem

    if (skin) {
      if (typeof skin.slim !== 'boolean') skin.slim = false
    }

    this.log(`Upload texture ${gameProfile.name}(${gameProfile.id})`)

    this.setSkinController = new AbortController()
    const data = await sys.setSkin(user, gameProfile, options, this.setSkinController.signal).finally(() => {
      this.setSkinController = undefined
    })
    this.state.userProfile(data)
  }

  /**
   * Save the skin to the disk.
   */
  async saveSkin(options: SaveSkinOptions) {
    requireObject(options)
    requireString(options.url)
    requireString(options.path)
    const { path, url } = options
    const downloadOptions = await this.app.registry.get(kDownloadOptions)
    await new DownloadTask({ url, destination: path, ...downloadOptions }).startAndWait()
  }

  /**
   * Refresh the current user login status
   */
  @Lock('refreshUser')
  async refreshUser(userId: string) {
    const user = this.state.users[userId]

    if (!user) {
      this.log('Skip refresh user status as the user is empty.')
      return
    }

    const system = this.accountSystems[user.authority] || this.yggdrasilAccountSystem.yggdrasilAccountSystem
    this.refreshController = new AbortController()

    const newUser = await system.refresh(user, this.refreshController.signal).finally(() => {
      this.refreshController = undefined
    })

    this.state.userProfile(newUser)

    if (newUser.invalidated) {
      throw new UserException({ type: 'userAccessTokenExpired' })
    }
  }

  async selectUserGameProfile(userProfile: UserProfile, gameProfileId: string): Promise<void> {
    userProfile.selectedProfile = gameProfileId
    this.state.userProfile(userProfile)
  }

  @Singleton(p => p.id)
  async removeUser(userProfile: UserProfile) {
    requireObject(userProfile)
    this.state.userProfileRemove(userProfile.id)
  }

  async getOfficialUserProfile(): Promise<(UserProfile & { accessToken: string | undefined }) | undefined> {
    await this.initialize()
    const official = Object.values(this.state.users).find(u => u.authority === AUTHORITY_MICROSOFT)
    if (official) {
      const controller = new AbortController()
      await this.accountSystems.microsoft?.refresh(official, controller.signal)
      const accessToken = await this.tokenStorage.get(official)
      return { ...official, accessToken }
    }
    return undefined
  }

  async abortLogin(): Promise<void> {
    this.loginController?.abort()
  }

  async abortRefresh() {
    this.refreshController?.abort()
  }

  getAccountSystem(service: string) {
    return this.accountSystems[service]
  }
}
