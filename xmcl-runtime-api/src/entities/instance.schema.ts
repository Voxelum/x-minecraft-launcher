import { z } from 'zod'

export const InstanceGroupData = z.object({
  color: z.string(),
  name: z.string(),
  id: z.string(),
  instances: z.array(z.string()),
})
export type InstanceGroupData = z.infer<typeof InstanceGroupData>

export const InstanceGroupDataOrString = z.union([InstanceGroupData, z.string()])
export type InstanceGroupDataOrString = z.infer<typeof InstanceGroupDataOrString>
export const InstanceGroupDataOrStringArray = z.array(InstanceGroupDataOrString)

/**
 * Instance selection and import configuration.
 * Zod schema for runtime validation with defaults.
 */
export const InstancesSchema = z.object({
  /** The selected instance identifier */
  selectedInstance: z.string().default(''),
  /** The extra imported instance path */
  instances: z.array(z.string()).default([]),
  /** The instance groups */
  groups: InstanceGroupDataOrStringArray.default([]),
})
export type InstancesSchema = z.infer<typeof InstancesSchema>

/**
 * Modpack metadata for export configuration.
 * Zod schema for runtime validation with defaults.
 */
export const InstanceModpackMetadataSchema = z.object({
  /** The metadata file format (currently 0) */
  version: z.literal(0),
  /** The export directory for modpack files. Absolute path required. If absent, exports to user desktop. */
  exportDirectory: z.string().default(''),
  /** The current modpack version. Start from 0.0.1 */
  modpackVersion: z.string().default('0.0.1'),
  /** Emit the curseforge modpack format */
  emitCurseforge: z.boolean().default(true),
  /** Emit the modrinth modpack format */
  emitModrinth: z.boolean().default(true),
  /** Emit the modrinth modpack format with strict version */
  emitModrinthStrict: z.boolean().default(true),
  /** Emit the offline format zip */
  emitOffline: z.boolean().default(false),
  /** The files to included in last export */
  emittedFiles: z.array(z.string()).default([]),
  /** The server-folder files included in server exports and deployments. */
  emittedServerFiles: z.array(z.string()).default([]),
  /** The files environment assignments. Key is the file path. */
  filesEnvironments: z
    .record(
      z.string(),
      z.object({
        /** Client environment */
        client: z.string(),
        /** Server environment */
        server: z.string(),
      }),
    )
    .default({}),
  modrinth: z.object({
    projectId: z.string().default(''),
    profile: z.enum(['universal', 'client', 'server', 'split']).default('client'),
    versionType: z.enum(['release', 'beta', 'alpha']).default('release'),
    pendingProjectStatus: z.enum(['approved', 'unlisted', 'private']).optional(),
    lastVersionId: z.string().default(''),
    lastPublishedAt: z.number().default(0),
    /** The mods/resourcepacks/shaderpacks file paths included in the last successful publish. Used to compute a changelog diff for the next version. */
    lastPublishedFiles: z.array(z.string()).default([]),
    artifacts: z.array(z.object({
      profile: z.enum(['universal', 'client', 'server']),
      path: z.string(),
    })).default([]),
  }).default({
    projectId: '',
    profile: 'client',
    versionType: 'release',
    pendingProjectStatus: undefined,
    lastVersionId: '',
    lastPublishedAt: 0,
    lastPublishedFiles: [],
    artifacts: [],
  }),
})

/**
 * Inferred TypeScript interface from InstanceModpackMetadataZodSchema.
 */
export type InstanceModpackMetadataSchema = z.infer<typeof InstanceModpackMetadataSchema>
