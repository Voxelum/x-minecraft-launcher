/* eslint-disable @typescript-eslint/no-redeclare */
import { GameProfile, YggdrasilTexture } from '@xmcl/user'
import { Schema } from './schema'
import _UserSchema from './UserSchema.json'

export const UserSchema: Schema<UserSchema> = _UserSchema

/* eslint-disable import/export  */
/* eslint-disable @typescript-eslint/no-var-requires */

export interface GameProfileAndTexture extends GameProfile {
  textures: {
    SKIN: YggdrasilTexture
    CAPE?: YggdrasilTexture
    ELYTRA?: YggdrasilTexture
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

export interface UserProfileCompatible {
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
   * @deprecated
   */
  authService?: string
  /**
   * If the user profile is invalidated and should be re-login
   */
  invalidated: boolean
  /**
   * The authority url
   */
  authority?: string
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
   * If the user profile is invalidated and should be re-login
   */
  invalidated: boolean
  /**
   * The authority service uri.
   */
  authority: string
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
  users: { [account: string]: UserProfileCompatible }
}
