import { GameProfile, MojangChallenge, MojangChallengeResponse, ProfileServiceAPI, YggdrasilAuthAPI } from '@xmcl/user'
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
  properties?: object
}

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
   * The skin url. Can be either a http/https url or a file: protocol url.
   */
  url: string
  /**
   * If the skin is using slim model.
   */
  slim: boolean
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
  'microsoft-authorize-url': string
  'microsoft-authorize-code': [any, string]
  'auth-profile-added': string
}

export class UserState implements UserSchema {
  // user data
  users: Record<string, UserProfile> = {}
  selectedUser = {
    id: '',
    profile: '',
  }

  clientToken = ''

  get user(): UserProfile | undefined {
    return this.users[this.selectedUser.id]
  }

  get gameProfile() {
    return this.user?.profiles[this.selectedUser.profile]
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
    this.selectedUser.profile = snapshot.selectedUser.profile

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
      this.selectedUser.profile = ''
    }
    delete this.users[userId]
  }

  userProfile(user: UserProfile) {
    this.users[user.id] = user
  }

  userGameProfileSelect({ userId, profileId }: { userId: string; profileId: string }) {
    this.selectedUser.id = userId
    this.selectedUser.profile = profileId
  }
}

export interface UserService extends StatefulService<UserState>, GenericEventEmitter<UserServiceEventMap> {
  /**
   * Refresh the current user login status
   */
  refreshUser(): Promise<void>
  /**
   * Refresh current skin status
   */
  refreshSkin(refreshSkinOptions?: RefreshSkinOptions): Promise<void>
  /**
   * Upload the skin to server. If the userId and profileId is not assigned,
   * it will use the selected user and selected profile.
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
   * Switch user account.
   */
  switchUserProfile(options: SwitchProfileOptions): Promise<void>
  /**
   * Remove the user profile. This will logout to the user
   */
  removeUserProfile(userId: string): Promise<void>

  setUserProfile(userProfile: UserProfile): Promise<void>

  getSupportedAccountSystems(): Promise<string[]>

  login(options: LoginOptions): Promise<UserProfile>
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
}

export class UserException extends Exception<UserExceptions> { }
