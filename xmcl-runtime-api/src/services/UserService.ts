import { GameProfile } from '@xmcl/user'
import { Exception } from '../entities/exception'
import { GameProfileAndTexture, UserProfile, UserSchema } from '../entities/user.schema'
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
   * The account services
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
  // user data
  users: Record<string, UserProfile> = {}
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

  get isAccessTokenValid(): boolean {
    return this.user?.accessToken !== ''
  }

  get offline(): boolean {
    return this.user?.authService === 'offline'
  }

  get isYggdrasilService(): boolean {
    return this.user?.authService !== 'offline' && this.user?.authService !== 'microsoft'
  }

  get isThirdPartyAuthentication(): boolean {
    const user = this.user
    return user?.authService !== 'mojang' && user?.authService !== 'offline' && user?.authService !== 'microsoft'
  }

  userSnapshot(snapshot: UserSchema) {
    this.clientToken = snapshot.clientToken
    this.selectedUser.id = snapshot.selectedUser.id

    if (typeof snapshot.users === 'object') {
      this.users = snapshot.users
    }
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

  userInvalidate() {
    if (this.users[this.selectedUser.id].authService !== 'offline') {
      this.users[this.selectedUser.id].accessToken = ''
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
      current.accessToken = user.accessToken
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
}

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
   * Get all supported account systems.
   *
   * This might be influenced by locale regions .
   */
  getSupportedAccountSystems(): Promise<string[]>
  /**
   * Login new user account.
   */
  login(options: LoginOptions): Promise<UserProfile>
  /**
   * Abort current login
   */
  abortLogin(): Promise<void>
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
}

export class UserException extends Exception<UserExceptions> { }
