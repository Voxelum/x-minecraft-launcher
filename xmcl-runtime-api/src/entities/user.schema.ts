/* eslint-disable @typescript-eslint/no-redeclare */
import { GameProfile } from '@xmcl/user'
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

  uploadable?: Array<'skin' | 'cape'>

  skins?: Array<{
    id: string
    state: 'ACTIVE' | 'INACTIVE'
    url: string
    variant: 'CLASSIC' | 'SLIM'
  }>

  capes?: Array<{
    id: string
    state: 'ACTIVE' | 'INACTIVE'
    url: string
    alias: string
  }>
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
   * The used auth service name
   */
  authService: string
  /**
   * The access token of the user. The token is invalid either in
   *
   * - This access token value is set to empty string
   * - The `expiredAt` is larger than `Date.now()`
   */
  accessToken: string
  /**
   * The expire time
   */
  expiredAt: number
  /**
   * All available game profiles
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
   * All saved user account through multiple services
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
  }
  /**
   * The client token of current client. The launcher will generate one at first launch.
   * @default ""
   */
  clientToken: string
}
