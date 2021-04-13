/* eslint-disable @typescript-eslint/no-redeclare */
import { YggdrasilAuthAPI, ProfileServiceAPI, GameProfile } from '@xmcl/user'
import { Schema } from './schema'
import _UserSchema from './UserSchema.json'

export const UserSchema: Schema<UserSchema> = _UserSchema

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface GameProfileAndTexture extends GameProfile {
  textures: {
    SKIN: GameProfile.Texture
    CAPE?: GameProfile.Texture
    ELYTRA?: GameProfile.Texture
  }
}

export interface UserProfile {
  /**
     * User id. Also means the localId in new account_json
     */
  id: string
  /**
     * The username usually email
     */
  username: string

  /**
     * The used profile service name
     */
  profileService: string

  /**
     * The used auth service name
     */
  authService: string

  /**
     * The access token of the user
     */
  accessToken: string

  /**
     * All avaiable game profiles
     */
  profiles: { [uuid: string]: GameProfileAndTexture }

  /**
     * Selected profile uuid
     */
  selectedProfile: string

  /**
     * The avatar uri. This can be base64 data uri.
     */
  avatar?: string
}

export interface UserSchema {
  /**
     * All saved user account through mutliple services
     * @default {}
     */
  users: { [account: string]: UserProfile }

  /**
     * Contains the UUID-hashed account and the UUID of the currently selected user
     * @default { "account": "", "profile": "" }
     */
  selectedUser: {
    /**
         * The UUID-hashed key of the currently selected user
         * @default ""
         */
    id: string
    /**
         * The UUID of the currently selected player
         * @default ""
         */
    profile: string
  }
  /**
     * All loaded auth services api. Used for yggdrisal auth
     * @default {}
     */
  authServices: {
    [name: string]: YggdrasilAuthAPI
  }
  /**
     * All loaded profile services api. Used for
     * @default {}
     */
  profileServices: {
    [name: string]: ProfileServiceAPI
  }
  /**
     * The client token of current client. The launcher will generate one at first launch.
     * @default ""
     */
  clientToken: string
}
