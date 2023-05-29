/* eslint-disable @typescript-eslint/no-redeclare */
import { Schema } from './schema'
import _YggdrasilSchema from './YggdrasilSchema.json'

export const YggdrasilSchema: Schema<YggdrasilSchema> = _YggdrasilSchema

export interface AuthlibInjectorApiProfile {
  /**
   * @default {}
   */
  meta: {
    /**
     * @default ""
     */
    serverName: string
    /**
     * @default ""
     */
    implementationName: string
    /**
     * @default ""
     */
    implementationVersion: string
    /**
     * @default {}
     */
    links: {
      /**
       * @default ""
       */
      homepage: string
      /**
       * @default ""
       */
      register: string
    }
    /**
     * @default false
     */
    'feature.non_email_login': boolean
  }
  /**
   * @default []
   */
  skinDomains: string[]
  /**
   * @default ""
   */
  signaturePublickey: string
}

export interface YggdrasilApi {
  /**
   * The base service url
   */
  url: string
  /**
   * It will use `url + '/sessionserver/session/minecraft/profile/${uuid}'` by default
   */
  profile?: string
  /**
   * It will use `url + "/api/user/profile/${uuid}/${type}"` by default
   */
  texture?: string
  /**
   * It will use `url + "/authserver"` by default
   */
  auth?: string
  /**
   * The cache for authlib injector compatible api
   */
  authlibInjector?: AuthlibInjectorApiProfile
  /**
   * The favicon of the service
   */
  favicon?: string
}

export interface YggdrasilSchema {
  /**
   * The customized third-party yggrasil services satisfying the authlib-injector api format
   * @default []
   */
  yggdrasilServices: Array<YggdrasilApi>
}
