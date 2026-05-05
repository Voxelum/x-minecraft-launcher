import { z } from 'zod'

/**
 * Runtime versions for a Minecraft instance
 */
export const RuntimeVersionsSchema = z
  .object({
    /** Minecraft version of this version. e.g. 1.7.10 */
    minecraft: z.string().catch('').default(''),
    /** Forge version of this version. e.g. 14.23.5.2838 */
    forge: z.string().catch('').default(''),
    /** NeoForged version of this version. e.g. 14.23.5.2838 */
    neoForged: z.string().catch('').default(''),
    /** Fabric loader version, e.g. 0.7.2+build.175 */
    fabricLoader: z.string().catch('').default(''),
    quiltLoader: z.string().catch('').default(''),
    /** Optifine version e.g. HD_U_F1_pre6 or HD_U_E6 */
    optifine: z.string().catch('').default(''),
    /** The labyMod version */
    labyMod: z.string().catch('').default(''),
  })

export type RuntimeVersions = z.infer<typeof RuntimeVersionsSchema>
export type PartialRuntimeVersions = Partial<RuntimeVersions> & { minecraft: string }

/**
 * Modrinth modpack upstream configuration
 */
export const ModrinthUpstreamSchema = z.object({
  type: z.literal('modrinth-modpack'),
  projectId: z.string(),
  versionId: z.string(),
  sha1: z.string().optional(),
})

export type ModrinthUpstream = z.infer<typeof ModrinthUpstreamSchema>

/**
 * Curseforge modpack upstream configuration
 */
export const CurseforgeUpstreamSchema = z.object({
  type: z.literal('curseforge-modpack'),
  modId: z.coerce.number(),
  fileId: z.coerce.number(),
  sha1: z.coerce.string().optional(),
})

export type CurseforgeUpstream = z.infer<typeof CurseforgeUpstreamSchema>

/**
 * FTB modpack upstream configuration
 */
export const FTBUpstreamSchema = z.object({
  type: z.literal('ftb-modpack'),
  id: z.coerce.number(),
  versionId: z.coerce.number(),
})

export type FTBUpstream = z.infer<typeof FTBUpstreamSchema>

/**
 * Peer upstream configuration (for local sharing)
 */
export const PeerUpstreamSchema = z.object({
  type: z.literal('peer'),
  id: z.string(),
})

export type PeerUpstream = z.infer<typeof PeerUpstreamSchema>

/**
 * Union type for all possible upstream configurations
 */
export const InstanceUpstreamSchema = z.discriminatedUnion('type', [
  CurseforgeUpstreamSchema,
  ModrinthUpstreamSchema,
  FTBUpstreamSchema,
  PeerUpstreamSchema,
])

export type InstanceUpstream = z.infer<typeof InstanceUpstreamSchema>

/**
 * Core instance data structure
 */
export const InstanceDataSchema = z.object({
  /** The display name of the profile. It will also be the modpack display name */
  name: z.coerce
    .string()
    .transform((v) => v.trim())
    .catch('')
    .default(''),
  /** The author of this instance */
  author: z.coerce.string().catch('').default(''),
  /** The description of this instance */
  description: z.coerce.string().catch('').default(''),
  /** The target version id to launch. It will be computed from "runtime" */
  version: z.coerce.string().catch('').default(''),
  /** The runtime version requirement of the profile */
  runtime: RuntimeVersionsSchema.catch({
    minecraft: '',
    forge: '',
    fabricLoader: '',
    optifine: '',
    quiltLoader: '',
    neoForged: '',
    labyMod: '',
  }).default({
    minecraft: '',
    forge: '',
    fabricLoader: '',
    optifine: '',
    quiltLoader: '',
    neoForged: '',
    labyMod: '',
  }),
  /** The java path on the disk */
  java: z
    .string()
    .optional(),
  /** The resolution of the game */
  resolution: z
    .object({
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      fullscreen: z.boolean().optional(),
    })
    .optional()
    .catch(undefined),
  /** Can be override by global setting */
  minMemory: z.number().nonnegative().optional().catch(undefined),
  /** Can be override by global setting */
  maxMemory: z.number().positive().optional().catch(undefined),
  /** Can be override by global setting */
  assignMemory: z
    .union([z.literal(true), z.literal('auto'), z.literal(false)])
    .optional()
    .catch(undefined),
  /** JVM options */
  vmOptions: z.array(z.coerce.string()).optional().catch(undefined),
  /** Minecraft options */
  mcOptions: z.array(z.coerce.string()).optional().catch(undefined),
  /** The launch environment variables */
  env: z.record(z.string(), z.coerce.string()).optional().catch(undefined),
  /** Command to prepend before launch */
  prependCommand: z.string().optional().catch(undefined),
  /** Command to execute before launch */
  preExecuteCommand: z.string().optional().catch(undefined),
  url: z.string().catch('').default(''),
  icon: z.string().catch('').default(''),
  fileApi: z.string().catch('').default(''),
  /** The option for instance to launch server directly */
  server: z
    .object({
      host: z.string(),
      port: z.number().positive().optional(),
    })
    .nullable()
    .optional()
    .catch(undefined),
  /** Various boolean flags */
  showLog: z.boolean().optional().catch(undefined),
  hideLauncher: z.boolean().optional().catch(undefined),
  fastLaunch: z.boolean().optional().catch(undefined),
  disableElybyAuthlib: z.boolean().optional().catch(undefined),
  disableAuthlibInjector: z.boolean().optional().catch(undefined),
  /** Use latest version settings */
  useLatest: z
    .union([z.literal(false), z.literal('release'), z.literal('alpha')])
    .optional()
    .catch(undefined),
  /** The upstream data source for this instance */
  upstream: InstanceUpstreamSchema.optional().catch(undefined),
})

export type InstanceData = z.infer<typeof InstanceDataSchema>

/**
 * Full instance schema with timestamps
 */
export const InstanceSchema = InstanceDataSchema.extend({
  path: z.string().optional(),
  lastAccessDate: z.coerce.number().catch(0).default(0),
  lastPlayedDate: z.coerce.number().catch(0).default(0),
  playtime: z.coerce.number().nonnegative().catch(0).default(0),
  creationDate: z.coerce.number().catch(0).default(0),
})

export const InstanceSchemaPartial = InstanceSchema.partial()

export type InstanceDataWithTime = z.infer<typeof InstanceSchema>

export type Instance = InstanceDataWithTime & {
  path: string
}

/**
 * Check if two upstream sources are from the same origin
 */
export function isUpstreamSameOrigin(a: InstanceUpstream, b: InstanceUpstream): boolean {
  const aType = a.type
  const bType = b.type
  if (aType !== bType) return false
  if (a.type === 'curseforge-modpack') return a.modId === (b as any).modId
  if (a.type === 'modrinth-modpack') return a.projectId === (b as any).projectId
  if (a.type === 'ftb-modpack') return a.id === (b as any).id
  if (a.type === 'peer') return a.id === (b as any).id
  return false
}
