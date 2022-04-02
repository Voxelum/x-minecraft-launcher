import { GameProfile, MojangChallenge, MojangChallengeResponse, ProfileServiceAPI, YggdrasilAuthAPI } from '@xmcl/user'
import { GenericEventEmitter } from '../events'
import { Exception } from '../entities/exception'
import { EMPTY_GAME_PROFILE, EMPTY_USER } from '../entities/user'
import { GameProfileAndTexture, UserProfile, UserSchema } from '../entities/user.schema'
import { ServiceKey, StatefulService } from './Service'

export interface LoginMicrosoftOptions {
  /**
   * The authorization code. If not present, it will try to get the auth code.
   */
  oauthCode?: string
  microsoftEmailAddress: string
}
export interface LoginOptions {
  /**
   * The user username. Can be email or other thing the auth service want.
   */
  username: string
  /**
   * The password. Maybe empty string.
   */
  password?: string
  /**
   * The auth service name, like mojang.
   */
  authService?: string
  /**
   * The profile serivce name, like mojang
   */
  profileService?: string
  /**
   * Select selected profile after login
   */
  selectProfile?: boolean
}
export interface RefreshSkinOptions {
  gameProfileId?: string
  userId?: string
  force?: boolean
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

interface UserServiceEventMap {
  'user-login': string
  'error': UserException
}

export class UserState implements UserSchema {
  // user data
  users: Record<string, UserProfile> = {}
  selectedUser = {
    id: '',
    profile: '',
  }

  clientToken = ''

  // client data
  authServices: Record<string, YggdrasilAuthAPI> = {
    mojang: {
      hostName: 'https://authserver.mojang.com',
      authenticate: '/authenticate',
      refresh: '/refresh',
      validate: '/validate',
      invalidate: '/invalidate',
      signout: '/signout',
    },
  }

  profileServices: Record<string, ProfileServiceAPI> = {
    mojang: {
      publicKey: `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAylB4B6m5lz7jwrcFz6Fd
/fnfUhcvlxsTSn5kIK/2aGG1C3kMy4VjhwlxF6BFUSnfxhNswPjh3ZitkBxEAFY2
5uzkJFRwHwVA9mdwjashXILtR6OqdLXXFVyUPIURLOSWqGNBtb08EN5fMnG8iFLg
EJIBMxs9BvF3s3/FhuHyPKiVTZmXY0WY4ZyYqvoKR+XjaTRPPvBsDa4WI2u1zxXM
eHlodT3lnCzVvyOYBLXL6CJgByuOxccJ8hnXfF9yY4F0aeL080Jz/3+EBNG8RO4B
yhtBf4Ny8NQ6stWsjfeUIvH7bU/4zCYcYOq4WrInXHqS8qruDmIl7P5XXGcabuzQ
stPf/h2CRAUpP/PlHXcMlvewjmGU6MfDK+lifScNYwjPxRo4nKTGFZf/0aqHCh/E
AsQyLKrOIYRE0lDG3bzBh8ogIMLAugsAfBb6M3mqCqKaTMAf/VAjh5FFJnjS+7bE
+bZEV0qwax1CEoPPJL1fIQjOS8zj086gjpGRCtSy9+bTPTfTR/SJ+VUB5G2IeCIt
kNHpJX2ygojFZ9n5Fnj7R9ZnOM+L8nyIjPu3aePvtcrXlyLhH/hvOfIOjPxOlqW+
O5QwSFP4OEcyLAUgDdUgyW36Z5mB285uKW/ighzZsOTevVUG2QwDItObIV6i8RCx
FbN2oDHyPaO5j1tTaBNyVt8CAwEAAQ==
-----END PUBLIC KEY-----`,
      // eslint-disable-next-line no-template-curly-in-string
      texture: 'https://api.mojang.com/user/profile/${uuid}/${type}',
      // eslint-disable-next-line no-template-curly-in-string
      profile: 'https://sessionserver.mojang.com/session/minecraft/profile/${uuid}',
      // eslint-disable-next-line no-template-curly-in-string
      profileByName: 'https://api.mojang.com/users/profiles/minecraft/${name}',
    },
  }

  /**
   * If this is true, user can get the skin data from mojang, else user has to answer the challenge to continue.
   */
  mojangSecurity = false

  get user(): UserProfile {
    return this.users[this.selectedUser.id] || EMPTY_USER
  }

  get gameProfile() {
    return this.user.profiles[this.selectedUser.profile] || EMPTY_GAME_PROFILE
  }

  get isAccessTokenValid(): boolean {
    return this.user.accessToken !== ''
  }

  get offline(): boolean {
    return this.user.authService === 'offline'
  }

  get isYggdrasilService(): boolean {
    return this.user.authService !== 'offline' && this.user.authService !== 'microsoft'
  }

  get isThirdPartyAuthentication(): boolean {
    const user = this.user
    return user.authService !== 'mojang' && user.authService !== 'offline' && user.authService !== 'microsoft'
  }

  get authService(): YggdrasilAuthAPI {
    return this.authServices[this.user.authService]
  }

  get profileService(): ProfileServiceAPI {
    return this.profileServices[this.user.profileService]
  }

  userSnapshot(snapshot: UserSchema) {
    this.clientToken = snapshot.clientToken
    this.selectedUser.id = snapshot.selectedUser.id
    this.selectedUser.profile = snapshot.selectedUser.profile

    if (typeof snapshot.users === 'object') {
      this.users = snapshot.users
    }
    if (snapshot.authServices) {
      this.authServices = { ...this.authServices, ...snapshot.authServices }
    }
    if (snapshot.profileServices) {
      this.profileServices = { ...this.profileServices, ...snapshot.profileServices }
    }
  }

  userSecurity(sec: boolean) {
    this.mojangSecurity = sec
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

  authServiceRemove(name: string) {
    delete this.authServices[name]
  }

  profileServiceRemove(name: string) {
    delete this.profileServices[name]
  }

  userProfileRemove(userId: string) {
    if (this.selectedUser.id === userId) {
      this.selectedUser.id = ''
      this.selectedUser.profile = ''
    }
    delete this.users[userId]
  }

  userProfileAdd(profile: Omit<UserProfile, 'profiles'> & { id: string; profiles: (GameProfileAndTexture | GameProfile)[] }) {
    function toObjectReducer<T extends { [k in K]: string }, K extends string>(key: K) {
      return (o: { [key: string]: T }, v: T) => { o[v[key]] = v; return o }
    }
    const value = {
      ...profile,
      profiles: profile.profiles
        .map(p => ({ ...p, textures: { SKIN: { url: '' } } }))
        .reduce(toObjectReducer<GameProfileAndTexture, 'id'>('id'), {}),
      selectedProfile: profile.selectedProfile,
    }
    this.users[profile.id] = value
  }

  userProfileUpdate(profile: { id: string; accessToken: string; profiles: (GameProfileAndTexture | GameProfile)[]; selectedProfile?: string }) {
    const user = this.users[profile.id]
    user.accessToken = profile.accessToken
    profile.profiles.forEach((p) => {
      if (user.profiles[p.id]) {
        user.profiles[p.id] = {
          ...user.profiles[p.id],
          ...p,
        }
      } else {
        user.profiles[p.id] = {
          textures: { SKIN: { url: '' } },
          ...p,
        }
      }
    })
    if (profile.selectedProfile !== undefined) {
      user.selectedProfile = profile.selectedProfile
    }
  }

  userGameProfileSelect({ userId, profileId }: { userId: string; profileId: string }) {
    this.selectedUser.id = userId
    this.selectedUser.profile = profileId
  }

  authServiceSet({ name, api }: { name: string; api: YggdrasilAuthAPI }) {
    this.authServices[name] = api
  }

  profileServiceSet({ name, api }: { name: string; api: ProfileServiceAPI }) {
    this.profileServices[name] = api
  }
}

export interface UserService extends StatefulService<UserState>, GenericEventEmitter<UserServiceEventMap> {
  /**
   * Check current ip location and determine wether we need to validate user identity by response challenge.
   *
   * See `getChallenges` and `submitChallenges`
   */
  checkLocation(): Promise<boolean>
  /**
   * Get all the user set challenges for security reasons.
   */
  getChallenges(): Promise<MojangChallenge[]>
  submitChallenges(responses: MojangChallengeResponse[]): Promise<boolean>
  /**
   * Refresh the user auth status
   */
  refreshStatus(): Promise<void>
  /**
   * Refresh current skin status
   */
  refreshSkin(refreshSkinOptions?: RefreshSkinOptions): Promise<void>
  /**
   * Upload the skin to server. If the userId and profileId is not assigned,
   * it will use the selected user and selected profile.
   *
   * Notice that this operation might fail if the user is not authorized (accessToken is not valid).
   * If that happened, please let user refresh it credential or relogin.
   */
  uploadSkin(options: UploadSkinOptions): Promise<void>
  /**
   * Save the skin to the disk.
   */
  saveSkin(options: {
    url: string
    path: string
  }): Promise<void>

  /**
   * Refresh the current user login status
   */
  refreshUser(): Promise<void>
  /**
    * Switch user account.
    */
  switchUserProfile(payload: {
    /**
     * The user id of the user
     */
    userId: string
    /**
     * The game profile id of the user
     */
    profileId: string
  }): Promise<void>

  removeUserProfile(userId: string): Promise<void>

  /**
   * The workaround to cancel the microsoft login. Preventing the login forever.
   */
  cancelMicrosoftLogin(): Promise<void>

  loginMicrosoft(options: LoginMicrosoftOptions): Promise<{
    userId: string
    accessToken: string
    gameProfiles: GameProfileAndTexture[]
    selectedProfile: GameProfileAndTexture
    avatar: string | undefined
  } | {
    userId: string
    accessToken: string
    gameProfiles: never[]
    selectedProfile: undefined
    avatar: string | undefined
  }>

  /**
   * Login the user by current login mode. Refresh the skin and account information.
   */
  login(options: LoginOptions): Promise<void>
  /**
   * Logout and clear current cache.
   */
  logout(): Promise<void>
}

export const UserServiceKey: ServiceKey<UserService> = 'UserService'

export type UserExceptions = {
  type: 'loginInternetNotConnected' | 'loginInvalidCredentials' | 'loginGeneral'
} | {
  type: 'loginGeneral'
} | {
  type: 'fetchMinecraftProfileFailed'
  path: '/minecraft/profile'
  errorType: 'NOT_FOUND' | string
  error: string | 'NOT_FOUND'
  errorMessage: string
  developerMessage: string
}

export class UserException extends Exception<UserExceptions> { }
