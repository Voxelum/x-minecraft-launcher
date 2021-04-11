import { MojangChallengeResponse } from '@xmcl/user'
import { ServiceKey } from './Service'
import { GameProfileAndTexture } from '/@shared/entities/user.schema'
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
export interface UserService {
  /**
     * Logout and clear current cache.
     */
  logout(): Promise<void>
  /**
     * Check current ip location and determine wether we need to validate user identity by response challenge.
     *
     * See `getChallenges` and `submitChallenges`
     */
  checkLocation(): Promise<boolean>
  /**
     * Get all the user set challenges for security reasons.
     */
  getChallenges(): Promise<import('@xmcl/user').MojangChallenge[]>
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
}

export const UserServiceKey: ServiceKey<UserService> = 'UserService'
