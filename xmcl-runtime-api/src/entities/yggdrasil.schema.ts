import { z } from 'zod'

/**
 * Authlib Injector API profile metadata links.
 */
export const AuthlibInjectorLinksSchema = z.object({
  homepage: z.string(),
  register: z.string(),
})

/**
 * Authlib Injector API profile metadata.
 */
export const AuthlibInjectorMetaSchema = z.object({
  serverName: z.string().default(''),
  implementationName: z.string().default(''),
  implementationVersion: z.string().default(''),
  links: AuthlibInjectorLinksSchema,
  'feature.non_email_login': z.boolean().default(false),
  'feature.openid_configuration_url': z.string().optional(),
})

/**
 * Authlib Injector API profile.
 */
export const AuthlibInjectorApiProfileSchema = z.object({
  meta: AuthlibInjectorMetaSchema,
  skinDomains: z.array(z.string()).default([]),
  signaturePublickey: z.string().default(''),
})

export type AuthlibInjectorApiProfile = z.infer<typeof AuthlibInjectorApiProfileSchema>

/**
 * OIDC-like configuration for authentication.
 */
export const OICDLikeConfigSchema = z.object({
  issuer: z.string(),
  jwks_uri: z.string(),
  subject_types_supported: z.array(z.string()),
  id_token_signing_alg_values_supported: z.array(z.string()),
  scopes_supported: z.array(z.string()),
  token_endpoint: z.string(),
  userinfo_endpoint: z.string(),
  shared_client_id: z.string().optional(),
  device_authorization_endpoint: z.string().optional(),
  authorization_endpoint: z.string().optional(),
})

export type OICDLikeConfig = z.infer<typeof OICDLikeConfigSchema>

/**
 * Yggdrasil Connect API configuration.
 */
export const YggdrasilConnectApiSchema = z.object({
  url: z.string(),
  clientId: z.string(),
  ocidConfig: OICDLikeConfigSchema.optional(),
})

export type YggdrasilConnectApi = z.infer<typeof YggdrasilConnectApiSchema>

/**
 * Yggdrasil API configuration for a single service.
 */
export const YggdrasilApiSchema = z.object({
  /** The base service url */
  url: z.string(),
  /** It will use `url + '/sessionserver/session/minecraft/profile/${uuid}'` by default */
  profile: z.string().optional(),
  /** It will use `url + "/api/user/profile/${uuid}/${type}"` by default */
  texture: z.string().optional(),
  /** It will use `url + "/authserver"` by default */
  auth: z.string().optional(),
  /** The cache for authlib injector compatible api */
  authlibInjector: AuthlibInjectorApiProfileSchema.optional(),
  /** OIDC configuration */
  ocidConfig: OICDLikeConfigSchema.optional(),
  /** The favicon of the service */
  favicon: z.string().optional(),
})

export type YggdrasilApi = z.infer<typeof YggdrasilApiSchema>

/**
 * Yggdrasil services configuration schema.
 * Zod schema for runtime validation with defaults.
 */
export const YggdrasilSchema = z.object({
  /** The customized third-party yggrasil services satisfying the authlib-injector api format */
  yggdrasilServices: z.array(YggdrasilApiSchema).default([]),
})

export type YggdrasilSchema = z.infer<typeof YggdrasilSchema>
