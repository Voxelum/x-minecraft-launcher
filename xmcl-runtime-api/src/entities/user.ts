import { GameProfileAndTexture, UserProfile } from './user.schema'

export interface UserGameProfile extends Omit<UserProfile, 'profiles'>, GameProfileAndTexture {
  userId: string
  id: string
}

export const EMPTY_USER = Object.freeze({ id: '', username: '', profileService: '', authService: '', accessToken: '', profiles: [], properties: {} })
export const EMPTY_GAME_PROFILE = Object.freeze({ id: '', name: '', textures: { SKIN: { url: '' } } })

/**
 * Minecraft new .minecraft/launcher_accounts.json
 */
export interface LauncherAccountsJsonSchema {
  /**
   * All accounts dictionary
   */
  accounts: {
    [localId: string]: {
      accessToken: string
      /**
       * Date string like 2020-12-10T09:54:52Z
       */
      accessTokenExpiresAt: string
      /**
       * Avatar url, can be data uri
       */
      avatar?: string

      eligibleForMigration: boolean
      hasMultipleProfiles: boolean
      legacy: boolean

      /**
       * uuid mapping to this from `accounts` object
       */
      localId: string

      /**
       * Only present in a mojang account
       */
      minecraftProfile?: {
        /**
         * user profile id
         */
        id: string
        /**
         * user display name
         */
        name: string
      }

      persistent: boolean
      /**
       * - For legacy mojang account. This is the account uuid.
       * - For xbox, not very sure its usage
       */
      remoteId: string
      type: 'Mojang' | 'Xbox'
      userProperites: any[]
      /**
       * - For Xbox account, this should also be the user display name.
       * - For legacy mojang account, this should be the email.
       */
      username: string
    }
  }
  /**
   * The active account local id
   */
  activeAccountLocalId: string
  /**
   * The client token
   */
  mojangClientToken: string
}
