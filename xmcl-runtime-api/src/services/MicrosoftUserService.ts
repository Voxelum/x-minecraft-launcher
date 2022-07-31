import { GameProfileAndTexture } from '../entities/user.schema'
import { GenericEventEmitter } from '../events'
import { ServiceKey } from './Service'

export interface LoginMicrosoftOptions {
  /**
   * The authorization code. If not present, it will try to get the auth code.
   */
  oauthCode?: string
  microsoftEmailAddress: string
}

interface MicrosoftUserServiceEventMap {
  'microsoft-authorize-url': string
  'microsoft-authorize-code': [any, string]
}

export interface MicrosoftUserService extends GenericEventEmitter<MicrosoftUserServiceEventMap> {
  /**
   * The workaround to cancel the microsoft login. Preventing the login forever.
   */
  cancelLogin(): Promise<void>

  login(options: LoginMicrosoftOptions): Promise<{
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
}

export const MicrosoftUserServiceKey: ServiceKey<MicrosoftUserService> = 'MicrosoftUserService'

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
