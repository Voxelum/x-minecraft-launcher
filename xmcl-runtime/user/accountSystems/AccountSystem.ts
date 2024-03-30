import { LoginOptions, UserProfile, GameProfileAndTexture, SkinPayload } from '@xmcl/runtime-api'

export interface UserAccountSystem {
  /**
   * User login
   */
  login(options: LoginOptions, abortSignal: AbortSignal): Promise<UserProfile>
  /**
   * Refresh the user profile
   */
  refresh(userProfile: UserProfile, signal: AbortSignal, slientOnly?: boolean, force?: boolean): Promise<UserProfile>
  /**
   * Set skin to the game profile. This should also update the game profile skin data and return the new user profile.
   */
  setSkin(userProfile: UserProfile, gameProfile: GameProfileAndTexture, payload: SkinPayload, signal: AbortSignal): Promise<UserProfile>
}
