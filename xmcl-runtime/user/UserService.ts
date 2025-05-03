/* eslint-disable quotes */
import { DownloadTask } from '@xmcl/installer'
import {
  AUTHORITY_MICROSOFT,
  AuthorityMetadata,
  UserService as IUserService,
  LoginOptions,
  RefreshUserOptions,
  SaveSkinOptions,
  SharedState,
  UploadSkinOptions,
  UserException,
  UserProfile,
  UserSchema,
  UserServiceKey,
  UserState
} from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { Inject, LauncherApp, LauncherAppKey, kGameDataPath } from '~/app'
import { kDownloadOptions } from '~/network'
import { ExposeServiceKey, Lock, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { requireObject, requireString } from '~/util/object'
import { SafeFile, createSafeFile } from '~/util/persistance'
import { YggdrasilSeriveRegistry, kYggdrasilSeriveRegistry } from './YggdrasilSeriveRegistry'
import { UserAccountSystem } from './accountSystems/AccountSystem'
import { YggdrasilAccountSystem, kYggdrasilAccountSystem } from './accountSystems/YggdrasilAccountSystem'
import { ensureLauncherProfile, preprocessUserData } from './userData'
import { UserTokenStorage, kUserTokenStorage } from './userTokenStore'
import { getModrinthAccessToken, loginModrinth } from './loginModrinth'
import { AnyError } from '~/util/error'

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
  private accountSystems: Record<string, UserAccountSystem> = {}
  private mojangSelectedUserId = ''

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(kUserTokenStorage) private tokenStorage: UserTokenStorage,
    @Inject(kYggdrasilAccountSystem) private yggdrasilAccountSystem: YggdrasilAccountSystem,
    @Inject(kYggdrasilSeriveRegistry) private yggdrasilSeriveRegistry: YggdrasilSeriveRegistry
  ) {
    super(app, () => store.registerStatic(new UserState(), UserServiceKey), async () => {
      const data = await this.userFile.read()
      const userData = {
        users: {},
        yggdrasilServices: [],
      }

      // This will fill the user data
      const { mojangSelectedUserId } = await preprocessUserData(userData, data, this.getMinecraftPath('launcher_profiles.json'), tokenStorage)
      this.mojangSelectedUserId = mojangSelectedUserId
      // Ensure the launcher profile

      app.registry.get(kGameDataPath).then((getPath) => {
        ensureLauncherProfile(getPath())
      })

      this.log(`Load ${Object.keys(userData.users).length} users`)

      this.state.userData(userData)

      // Refresh all users
      Promise.all(Object.values(userData.users as Record<string, UserProfile>).map((user) => {
        if (user.username) {
          return this.refreshUser(user.id, {
            silent: true,
            validate: true,
          }).catch((e) => {
            this.log(`Failed to refresh user ${user.id}`, e)
          })
        } else {
          return this.removeUser(user)
        }
      }))
    })

    this.userFile = createSafeFile(this.getAppDataPath('user.json'), UserSchema, this)
    this.state.subscribeAll(() => {
      this.saveUserFile()
    })
  }

  async hasModrinthToken(): Promise<boolean> {
    return !!await getModrinthAccessToken(this.app)
  }

  async loginModrinth(invalidate = false): Promise<void> {
    await loginModrinth(this.app, this, ['USER_READ_EMAIL', 'USER_READ', 'USER_WRITE', 'COLLECTION_CREATE', 'COLLECTION_READ', 'COLLECTION_WRITE', 'COLLECTION_DELETE'], invalidate, this.loginController?.signal)
  }

  addYggdrasilService(url: string): Promise<void> {
    return this.yggdrasilSeriveRegistry.addYggdrasilService(url)
  }

  removeYggdrasilService(url: string): Promise<void> {
    return this.yggdrasilSeriveRegistry.removeYggdrasilService(url)
  }

  async getSupportedAuthorityMetadata(): Promise<AuthorityMetadata[]> {
    const result = Object.values(this.accountSystems).concat(this.yggdrasilAccountSystem).map(s => s.getSupporetedAuthorityMetadata(true))
      .flat()
    return result
  }

  async removeUserGameProfile(userProfile: UserProfile, gameProfileId: string): Promise<void> {
    if (this.state.users[userProfile.id]) {
      delete this.state.users[userProfile.id].profiles[gameProfileId]
      this.state.userProfile(this.state.users[userProfile.id])
    }
  }

  async getUserState(): Promise<SharedState<UserState>> {
    await this.initialize()
    return this.state
  }

  @Lock('login')
  async login(options: LoginOptions): Promise<UserProfile> {
    const system = this.accountSystems[options.authority] || this.yggdrasilAccountSystem

    this.loginController = new AbortController()

    this.emit('user-login', options.authority)
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

    if (!gameProfile) {
      throw new AnyError('UploadSkinError', 'Unknown game profile.', {}, {
        profilesIds: Object.keys(user.profiles),
      })
    }

    const sys = this.accountSystems[user.authority] || this.yggdrasilAccountSystem

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
  @Singleton((v) => v)
  async refreshUser(userId: string, options: RefreshUserOptions = {}) {
    const user = this.state.users[userId]

    if (!user) {
      this.log('Skip refresh user status as the user is empty.')
      return
    }

    const system = this.accountSystems[user.authority] || this.yggdrasilAccountSystem
    this.refreshController = new AbortController()

    const newUser = await system.refresh(user, this.refreshController.signal, options).finally(() => {
      this.refreshController = undefined
    })

    // Only update the user if the user is still in the state
    if (this.state.users[userId]) {
      this.state.userProfile(newUser)

      if (newUser.invalidated) {
        throw new UserException({ type: 'userAccessTokenExpired' })
      }
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
      await this.accountSystems.microsoft?.refresh(official, controller.signal, {})
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
