import { MojangChallenge, MojangChallengeResponse } from '@xmcl/user'
import { UserProfile } from '../entities/user.schema'
import { ServiceKey } from './Service'

export interface LoginYggdrasilOptions {
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
   * The profile service name, like mojang
   */
  profileService?: string
  /**
   * Select selected profile after login
   */
  selectProfile?: boolean
}

export interface YggdrasilUserService {
  /**
   * Check current ip location and determine wether we need to validate user identity by response challenge.
   *
   * See `getChallenges` and `submitChallenges`
   */
  checkLocation(user: UserProfile): Promise<boolean>
  /**
   * Get all the user set challenges for security reasons.
   */
  getChallenges(user: UserProfile): Promise<MojangChallenge[]>

  submitChallenges(responses: MojangChallengeResponse[]): Promise<boolean>
  /**
   * Login the user by current login mode. Refresh the skin and account information.
   */
  login(options: LoginYggdrasilOptions): Promise<UserProfile>
}

export const YggdrasilUserServiceKey: ServiceKey<YggdrasilUserService> = 'YggdrasilUserService'

// export type UserExceptions = {
//   type: 'loginInternetNotConnected' | 'loginInvalidCredentials' | 'loginGeneral' | 'loginTimeout' | 'loginReset'
// } | {
//   type: 'loginGeneral'
// } | {
//   type: 'userAcquireMicrosoftTokenFailed'
//   error?: string
// } | {
//   type: 'userExchangeXboxTokenFailed'
//   error?: string
// } | {
//   type: 'userLoginMinecraftByXboxFailed'
//   error?: string
// } | {
//   type: 'userCheckGameOwnershipFailed'
//   error?: string
// } | {
//   type: 'fetchMinecraftProfileFailed'
//   errorType: 'NOT_FOUND' | string
//   error: string | 'NOT_FOUND'
//   errorMessage: string
//   developerMessage: string
// }

// export class UserException extends Exception<UserExceptions> { }
