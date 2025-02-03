import { LoginOptions, UserProfile, GameProfileAndTexture, SkinPayload, RefreshUserOptions, AuthorityMetadata } from '@xmcl/runtime-api'

export interface UserAccountSystem {
  /**
   * User login
   */
  login(options: LoginOptions, abortSignal: AbortSignal): Promise<UserProfile>
  /**
   * Refresh the user profile
   */
  refresh(userProfile: UserProfile, signal: AbortSignal, options: RefreshUserOptions): Promise<UserProfile>
  /**
   * Set skin to the game profile. This should also update the game profile skin data and return the new user profile.
   */
  setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, payload: SkinPayload, signal: AbortSignal): Promise<UserProfile>

  getSupporetedAuthorityMetadata(allowThirdparty: boolean): AuthorityMetadata[]
}
