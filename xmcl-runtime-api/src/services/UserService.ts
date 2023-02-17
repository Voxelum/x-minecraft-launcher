import { GameProfile } from '@xmcl/user'
import { Exception } from '../entities/exception'
import { GameProfileAndTexture, UserProfile, UserSchema, YggdrasilApi } from '../entities/user.schema'
import { GenericEventEmitter } from '../events'
import { ServiceKey, StatefulService } from './Service'

export interface RefreshSkinOptions {
  gameProfileId?: string
  userId?: string
  force?: boolean
}

export interface LoginOptions {
  username: string
  password?: string
  /**
   * The account service name.
   */
  service: string
  /**
   * Custom property for special login service
   */
  properties?: Record<string, string>
}

export type SkinPayload = Pick<UploadSkinOptions, 'skin' | 'cape'>

export interface UploadSkinOptions {
  /**
   * The game profile id of this skin
   */
  gameProfileId?: string
  /**
   * The user id of this skin
   */
  userId?: string
  /**
   * The player skin data.
   * - `undefined` means we don't want to change skin
   * - `null` means we want to reset texture
   */
  skin?: {
    /**
     * The skin url. Can be either a http/https url or a file: protocol url.
     */
    url: string
    /**
     * If the skin is using slim model.
     */
    slim: boolean
  } | null
  /**
   * The cape url.
   * - `undefined` means we don't want to set cape texture
   * - empty string means we want to reset cape texture
   */
  cape?: string
}

export interface SaveSkinOptions {
  url: string
  path: string
}

export interface SwitchProfileOptions {
  /**
   * The user id of the user
   */
  userId: string
  /**
   * The game profile id of the user
   */
  profileId: string
}

interface UserServiceEventMap {
  'user-login': string
  'error': UserException
  'auth-profile-added': string
}

export class UserState implements UserSchema {
  /**
   * The user id to user profile mapping
   */
  users: Record<string, UserProfile> = {}
  /**
   * All user registered yggdrasil api
   */
  yggdrasilServices: YggdrasilApi[] = []

  selectedUser = {
    id: '',
  }

  clientToken = ''

  get user(): UserProfile | undefined {
    return this.users[this.selectedUser.id]
  }

  get gameProfile() {
    const user = this.user
    return user?.profiles[user.selectedProfile]
  }

  get isThirdPartyAuthentication(): boolean {
    const user = this.user
    return user?.authService !== 'mojang' && user?.authService !== 'offline' && user?.authService !== 'microsoft'
  }

  userData(data: UserSchema) {
    this.clientToken = data.clientToken
    this.selectedUser.id = data.selectedUser.id
    this.users = data.users
    this.yggdrasilServices = data.yggdrasilServices
  }

  gameProfileUpdate({ profile, userId }: { userId: string; profile: (GameProfileAndTexture | GameProfile) }) {
    const userProfile = this.users[userId]
    if (profile.id in userProfile.profiles) {
      const instance = { textures: { SKIN: { url: '' } }, ...profile }
      userProfile.profiles[profile.id] = instance
    } else {
      userProfile.profiles[profile.id] = {
        textures: { SKIN: { url: '' } },
        ...profile,
      }
    }
  }

  userProfileRemove(userId: string) {
    if (this.selectedUser.id === userId) {
      this.selectedUser.id = ''
    }
    delete this.users[userId]
  }

  userProfile(user: UserProfile) {
    if (this.users[user.id]) {
      const current = this.users[user.id]
      current.avatar = user.avatar
      current.expiredAt = user.expiredAt
      current.profiles = user.profiles
      current.username = user.username
    } else {
      this.users[user.id] = user
    }
  }

  userSelect(id: string) {
    this.selectedUser.id = id
  }

  userGameProfileSelect({ userId, profileId }: { userId: string; profileId: string }) {
    const user = this.users[userId]
    if (user) {
      user.selectedProfile = profileId
    }
  }

  userYggdrasilServices(apis: YggdrasilApi[]) {
    this.yggdrasilServices = apis
  }

  userYggdrasilServicePut(api: YggdrasilApi) {
    const index = this.yggdrasilServices.findIndex((it) => it.url === api.url)
    if (index >= 0) {
      this.yggdrasilServices[index] = api
    } else {
      this.yggdrasilServices.push(api)
    }
  }
}

export const BUILTIN_USER_SERVICES = ['microsoft', 'mojang', 'offline']

export interface UserService extends StatefulService<UserState>, GenericEventEmitter<UserServiceEventMap> {
  /**
   * Refresh the current user login status.
   *
   * This will also refresh the game profiles with skins.
   *
   * This will failed if user need to re-login the user.
   *
   * @throw 'userAccessTokenExpired'
   */
  refreshUser(): Promise<void>
  /**
   * Upload the skin to server. If the userId and profileId is not assigned,
   * it will use the selected user and selected profile.
   *
   * This will update the user profile state.
   *
   * Notice that this operation might fail if the user is not authorized (accessToken is not valid).
   * If that happened, please let user refresh it credential or re-login.
   */
  uploadSkin(options: UploadSkinOptions): Promise<void>
  /**
   * Save the skin to the disk.
   */
  saveSkin(options: SaveSkinOptions): Promise<void>
  /**
   * Select user account.
   * @param userId User to be select
   */
  selectUser(userId: string): Promise<void>
  /**
   * Select a profile in current user
   * @param profileId The profile id
   */
  selectGameProfile(profileId: string): Promise<void>
  /**
   * Remove the user profile. This will logout to the user
   */
  removeUserProfile(userId: string): Promise<void>
  /**
   * Put a new user profile into storage
   */
  setUserProfile(userProfile: UserProfile): Promise<void>
  /**
   * Add a third-party account system satisfy the authlib-injector format
   * @param url The account api url
   */
  addYggdrasilAccountSystem(url: string): Promise<void>
  /**
   * Remove a third-party account system satisfy the authlib-injector format
   * @param url The account api url
   */
  removeYggdrasilAccountSystem(url: string): Promise<void>
  /**
   * Login new user account.
   */
  login(options: LoginOptions): Promise<UserProfile>
  /**
   * Abort current login
   */
  abortLogin(): Promise<void>
  /**
   * Abort the refresh user operation
   */
  abortRefresh(): Promise<void>
}

export const UserServiceKey: ServiceKey<UserService> = 'UserService'

export type UserExceptions = {
  type: 'loginInternetNotConnected' | 'loginInvalidCredentials' | 'loginGeneral' | 'loginTimeout' | 'loginReset'
} | {
  type: 'loginGeneral'
} | {
  type: 'userAcquireMicrosoftTokenFailed'
  error?: string
} | {
  type: 'userExchangeXboxTokenFailed'
  error?: string
} | {
  type: 'userLoginMinecraftByXboxFailed'
  error?: string
} | {
  type: 'userCheckGameOwnershipFailed'
  error?: string
} | {
  type: 'fetchMinecraftProfileFailed'
  errorType: 'NOT_FOUND' | string
  error: string | 'NOT_FOUND'
  errorMessage: string
  developerMessage: string
} | {
  type: 'userAccessTokenExpired'
} | {
  type: 'loginServiceNotSupported'
  service: string
}

export class UserException extends Exception<UserExceptions> { }
