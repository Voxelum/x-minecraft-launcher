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

    'feature.openid_configuration_url'?: string
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

export type OICDLikeConfig = {
  issuer: string
  jwks_uri: string
  subject_types_supported: string[]
  id_token_signing_alg_values_supported: string[]
  scopes_supported: string[]
  token_endpoint: string
  userinfo_endpoint: string
} & ({
  device_authorization_endpoint: string
} | {
  authorization_endpoint: string
})

export interface YggdrasilConnectApi {
  url: string
  clientId: string
  ocidConfig?: OICDLikeConfig
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

  ocidConfig?: OICDLikeConfig
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
