import { z } from 'zod'

/**
 * Yggdrasil texture information.
 */
export const YggdrasilTextureSchema = z.object({
  url: z.string(),
  metadata: z.record(z.string(), z.string()).optional(),
})

export type YggdrasilTexture = z.infer<typeof YggdrasilTextureSchema>

/**
 * Skin information for Microsoft accounts.
 */
export const SkinInfoSchema = z.object({
  id: z.string(),
  state: z.enum(['ACTIVE', 'INACTIVE']),
  url: z.string(),
  variant: z.enum(['CLASSIC', 'SLIM']),
})

/**
 * Cape information for Microsoft accounts.
 */
export const CapeInfoSchema = z.object({
  id: z.string(),
  state: z.enum(['ACTIVE', 'INACTIVE']),
  url: z.string(),
  alias: z.string(),
})

/**
 * Game profile with texture information.
 */
export const GameProfileAndTextureSchema = z.object({
  id: z.string(),
  name: z.string(),
  properties: z.record(z.string(), z.string()).optional(),
  textures: z.object({
    SKIN: YggdrasilTextureSchema,
    CAPE: YggdrasilTextureSchema.optional(),
    ELYTRA: YggdrasilTextureSchema.optional(),
  }),
  uploadable: z.array(z.enum(['skin', 'cape'])).optional(),
  skins: z.array(SkinInfoSchema).optional(),
  capes: z.array(CapeInfoSchema).optional(),
})

export type GameProfileAndTexture = z.infer<typeof GameProfileAndTextureSchema>

/**
 * User profile compatible with legacy format.
 * @deprecated Use UserProfile instead
 */
export const UserProfileCompatibleSchema = z.object({
  /** User id. Also means the localId in new account_json */
  id: z.string(),
  /** The username usually email */
  username: z.string(),
  /** The used auth service name @deprecated */
  authService: z.string().optional(),
  /** If the user profile is invalidated and should be re-login */
  invalidated: z.boolean(),
  /** The authority url */
  authority: z.string().optional(),
  /** The expire time */
  expiredAt: z.number(),
  /** All available game profiles */
  profiles: z.record(z.string(), GameProfileAndTextureSchema),
  /** Selected profile uuid */
  selectedProfile: z.string(),
  /** The avatar uri. This can be base64 data uri. */
  avatar: z.string().optional(),
})

export type UserProfileCompatible = z.infer<typeof UserProfileCompatibleSchema>

/**
 * User profile information.
 */
export const UserProfileSchema = z.object({
  /** User id. Also means the localId in new account_json */
  id: z.string(),
  /** The username usually email */
  username: z.string(),
  /** If the user profile is invalidated and should be re-login */
  invalidated: z.boolean(),
  /** The authority service uri. */
  authority: z.string(),
  /** The expire time */
  expiredAt: z.number(),
  /** All available game profiles */
  profiles: z.record(z.string(), GameProfileAndTextureSchema),
  /** Selected profile uuid */
  selectedProfile: z.string(),
  /** The avatar uri. This can be base64 data uri. */
  avatar: z.string().optional(),
  /** oidc home account id */
  homeAccountId: z.string().optional(),
})

export type UserProfile = z.infer<typeof UserProfileSchema>

/**
 * User schema containing all saved user accounts.
 * Zod schema for runtime validation with defaults.
 */
export const UserSchema = z.object({
  /** All saved user account through multiple services */
  users: z.record(z.string(), UserProfileCompatibleSchema).default({}),
})

export type UserSchema = z.infer<typeof UserSchema>

/**
 * Modrinth user authentication info.
 */
export const ModrinthUserSchema = z.object({
  id: z.string(),
  accessToken: z.string(),
})

export type ModrinthUser = z.infer<typeof ModrinthUserSchema>
