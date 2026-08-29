/* eslint-disable quotes */
import { download } from '@xmcl/file-transfer'
import {
  AUTHORITY_MICROSOFT,
  UserException,
  Users,
  UserServiceKey,
  UserState,
  type AuthorityMetadata,
  type UserService as IUserService,
  type LoginOptions,
  type RefreshUserOptions,
  type SaveSkinOptions,
  type SharedState,
  type UploadSkinOptions,
  type UserProfile
} from '@xmcl/runtime-api'
import { AnyError } from '@xmcl/utils'
import debounce from 'lodash.debounce'
import { Inject, LauncherApp, LauncherAppKey, kGameDataPath } from '~/app'
import { ExternalCredentialService } from '~/credential/ExternalCredentialService'
import { kDownloadOptions } from '~/network'
import { ExposeServiceKey, Lock, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { writeFile, copyFile } from 'node:fs/promises'
import { requireObject, requireString } from '~/util/object'
import { YggdrasilSeriveRegistry, kYggdrasilSeriveRegistry } from './YggdrasilSeriveRegistry'
import type { UserAccountSystem } from './accountSystems/AccountSystem'
import { YggdrasilAccountSystem, kYggdrasilAccountSystem } from './accountSystems/YggdrasilAccountSystem'
import { kUserTokenStorage, type UserTokenStorage } from './userTokenStore'
import { getModrinthAccessToken, loginModrinth } from './utils/loginModrinth'
import { ensureLauncherProfile, preprocessUserData } from './utils/userData'
import { UserPersistence, type UserPersistenceIntent } from './UserPersistence'

@ExposeServiceKey(UserServiceKey)
export class UserService extends StatefulService<UserState> implements IUserService {
  private userJsonPath: string
  private userPersistence: UserPersistence
  private persistenceReady = false
  private explicitEmptyUserPersistence = false
  private persistenceQueue: Promise<void> = Promise.resolve()
  private saveUserFile = debounce(() => {
    const userData = Users.parse({ users: this.state.users })
    const intent: UserPersistenceIntent = Object.keys(userData.users).length === 0 && this.explicitEmptyUserPersistence
      ? 'explicit-empty'
      : 'automatic'
    this.persistenceQueue = this.persistenceQueue
      .then(() => this.userPersistence.persist(userData, intent))
      .then(() => undefined)
      .catch(() => {
        // Do not include the failed profile or error object: either may contain
        // account details and persistence will retry after the next mutation.
        this.warn('Failed to persist user profile changes.')
      })
  }, 1000)

  private loginController: AbortController | undefined
  private refreshController: AbortController | undefined
  private setSkinController: AbortController | undefined
  private accountSystems: Record<string, UserAccountSystem> = {}
  private mojangSelectedUserId = ''

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager
  ) {
    super(app, () => store.registerStatic(new UserState(), UserServiceKey), async () => {
      const tokenStorage = await this.getTokenStorage()
      const persisted = await this.userPersistence.load()
      const data = persisted.users
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
      this.persistenceReady = true

      // Refresh all users without blocking the initial state. The renderer must
      // be able to show persisted users even if a refresh stalls or fails.
      void Promise.all(Object.values(userData.users as Record<string, UserProfile>).map((user) => {
        if (user.username) {
          return this.refreshUser(user.id, {
            silent: true,
            validate: true,
          }).catch((e) => {
            this.log(`Failed to refresh user ${user.id}`, e)
          })
        } else {
          // This is startup cleanup, not a user-requested logout. It must
          // not grant permission to replace a valid profile with empty data.
          this.state.userProfileRemove(user.id)
        }
      }))
    })

    this.userJsonPath = this.getAppDataPath('user.json')
    this.userPersistence = new UserPersistence(this.userJsonPath)
    this.state.subscribeAll(() => {
      if (!this.persistenceReady) return
      if (Object.keys(this.state.users).length > 0) {
        this.explicitEmptyUserPersistence = false
      }
      this.saveUserFile()
    })
    app.registryDisposer(async () => {
      this.saveUserFile.flush()
      await this.persistenceQueue
    })
  }

  private getExternalCredentials(): Promise<ExternalCredentialService> {
    return this.app.registry.getOrCreate(ExternalCredentialService)
  }

  private getTokenStorage(): Promise<UserTokenStorage> {
    return this.app.registry.get(kUserTokenStorage)
  }

  private getYggdrasilAccountSystem(): Promise<YggdrasilAccountSystem> {
    return this.app.registry.get(kYggdrasilAccountSystem)
  }

  private getYggdrasilServiceRegistry(): Promise<YggdrasilSeriveRegistry> {
    return this.app.registry.get(kYggdrasilSeriveRegistry)
  }

  private async resolveAccountSystem(authority: string): Promise<UserAccountSystem> {
    return this.accountSystems[authority] || await this.getYggdrasilAccountSystem()
  }

  async hasModrinthToken(): Promise<boolean> {
    return !!await getModrinthAccessToken(this.app, await this.getExternalCredentials())
  }

  // Dedupe concurrent calls so we never open multiple OAuth browser windows.
  // The `invalidate` flag is part of the singleton key so a forced re-auth
  // can still proceed even while a non-invalidating call is in flight.
  @Singleton((invalidate?: boolean) => `loginModrinth-${invalidate ? '1' : '0'}`)
  async loginModrinth(invalidate = false): Promise<void> {
    await loginModrinth(this.app, this, ['USER_READ_EMAIL', 'USER_READ', 'USER_WRITE', 'COLLECTION_CREATE', 'COLLECTION_READ', 'COLLECTION_WRITE', 'COLLECTION_DELETE', 'PROJECT_CREATE', 'PROJECT_READ', 'PROJECT_WRITE', 'VERSION_CREATE', 'VERSION_READ', 'VERSION_WRITE'], invalidate, this.loginController?.signal, await this.getExternalCredentials())
  }

  async addYggdrasilService(url: string): Promise<void> {
    return (await this.getYggdrasilServiceRegistry()).addYggdrasilService(url)
  }

  async removeYggdrasilService(url: string): Promise<void> {
    return (await this.getYggdrasilServiceRegistry()).removeYggdrasilService(url)
  }

  async getSupportedAuthorityMetadata(): Promise<AuthorityMetadata[]> {
    const result = Object.values(this.accountSystems).concat(await this.getYggdrasilAccountSystem()).map(s => s.getSupporetedAuthorityMetadata(true))
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
    const system = await this.resolveAccountSystem(options.authority)

    this.loginController = new AbortController()

    this.emit('user-login', options.authority)
    const profile = await system.login(options, this.loginController.signal)
      .finally(() => { this.loginController = undefined })

    this.state.userProfile(profile)
    this.emit('user-login-success', profile)
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

    const sys = await this.resolveAccountSystem(user.authority)

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

    if (url.startsWith('data:')) {
      const base64 = url.substring(url.indexOf(',') + 1)
      await writeFile(path, Buffer.from(base64, 'base64'))
      return
    }

    if (url.startsWith('file://')) {
      const srcPath = url.replace('file://', '')
      await copyFile(srcPath, path)
      return
    }

    if (url.startsWith('http://launcher/media')) {
      const parsed = new URL(url)
      const srcPath = parsed.searchParams.get('path')
      if (srcPath) {
        await copyFile(srcPath, path)
        return
      }
    }

    const downloadOptions = await this.app.registry.get(kDownloadOptions)
    await download({ url, destination: path, ...downloadOptions })
  }

  /**
   * Refresh the current user login status
   */
  @Singleton((v) => v)
  async refreshUser(userId: string, options: RefreshUserOptions = {}) {
    const user = this.state.users[userId] as UserProfile | undefined

    if (!user) {
      this.log('Skip refresh user status as the user is empty.')
      throw new AnyError('UserNotFound', `User ${userId} not found when refreshing user.`)
    }

    const system = await this.resolveAccountSystem(user.authority)
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

      this.emit('user-refresh-success', newUser)
    }

    return newUser
  }

  async selectUserGameProfile(userProfile: UserProfile, gameProfileId: string): Promise<void> {
    userProfile.selectedProfile = gameProfileId
    this.state.userProfile(userProfile)
  }

  @Singleton(p => p.id)
  async removeUser(userProfile: UserProfile) {
    requireObject(userProfile)
    if (Object.keys(this.state.users).length === 1 && this.state.users[userProfile.id]) {
      this.explicitEmptyUserPersistence = true
    }
    this.state.userProfileRemove(userProfile.id)
  }

  async getOfficialUserProfile(): Promise<(UserProfile & { accessToken: string | undefined }) | undefined> {
    await this.initialize()
    const official = Object.values(this.state.users).find(u => u.authority === AUTHORITY_MICROSOFT)
    if (official) {
      // Route through refreshUser so we share the Singleton lock used by
      // startup refresh and the UI launch path. A direct call to
      // accountSystems.microsoft.refresh would bypass the lock and could
      // trigger two concurrent OAuth refreshes that race when writing the
      // token to secret storage.
      await this.refreshUser(official.id, { silent: true }).catch((e) => {
        this.log(`Failed to refresh official user ${official.id} for getOfficialUserProfile`, e)
      })
      const accessToken = await (await this.getTokenStorage()).get(official)
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
