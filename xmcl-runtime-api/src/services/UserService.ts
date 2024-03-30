import { GameProfile } from '@xmcl/user'
import { Exception } from '../entities/exception'
import { GameProfileAndTexture, UserProfile } from '../entities/user.schema'
import { GenericEventEmitter } from '../events'
import { MutableState } from '../util/MutableState'
import { ServiceKey } from './Service'

export interface RefreshSkinOptions {
  gameProfileId?: string
  userId?: string
  force?: boolean
}

export interface LoginOptions {
  username: string
  password?: string
  /**
   * The authority url.
   */
  authority: string
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
  userId: string
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
  'microsoft-authorize-url': string
  'device-code': {
    userCode: string
    deviceCode: string
    verificationUri: string
    expiresIn: number
    interval: number
    message: string
  }
}

export class UserState {
  /**
   * The user id to user profile mapping
   */
  users: Record<string, UserProfile> = {}

  userData(data: { users: Record<string, UserProfile> }) {
    this.users = data.users
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
    delete this.users[userId]
  }

  userProfile(user: UserProfile) {
    if (this.users[user.id]) {
      const current = this.users[user.id]
      current.avatar = user.avatar
      current.expiredAt = user.expiredAt
      current.profiles = user.profiles
      current.username = user.username
      current.selectedProfile = user.selectedProfile
      current.invalidated = user.invalidated
    } else {
      this.users[user.id] = user
    }
  }
}

export interface UserService extends GenericEventEmitter<UserServiceEventMap> {
  getUserState(): Promise<MutableState<UserState>>
  /**
   * Refresh the current user login status.
   *
   * This will also refresh the game profiles with skins.
   *
   * This will failed if user need to re-login the user.
   *
   * @throw 'userAccessTokenExpired'
   */
  refreshUser(userId: string, silent?: boolean, force?: boolean): Promise<void>
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
   * Remove the user profile. This will logout to the user
   */
  removeUser(userProfile: UserProfile): Promise<void>
  /**
   * Select game profile of a user.
   */
  selectUserGameProfile(userProfile: UserProfile, gameProfileId: string): Promise<void>
  /**
   * Remove the game profile of a user. This only supported for offline user currently.
   */
  removeUserGameProfile(userProfile: UserProfile, gameProfileId: string): Promise<void>
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
  /**
   * Get mojang selected user id
   */
  getMojangSelectedUser(): Promise<string>
}

export const UserServiceKey: ServiceKey<UserService> = 'UserService'

export type UserExceptions = {
  type: 'loginInternetNotConnected' | 'loginInvalidCredentials' | 'loginGeneral' | 'loginTimeout' | 'loginReset'
} | {
  type: 'userAcquireMicrosoftTokenFailed'
} | {
  type: 'userExchangeXboxTokenFailed'
} | {
  type: 'userLoginMinecraftByXboxFailed'
} | {
  type: 'userCheckGameOwnershipFailed'
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
  authority: string
}

export class UserException extends Exception<UserExceptions> { }
