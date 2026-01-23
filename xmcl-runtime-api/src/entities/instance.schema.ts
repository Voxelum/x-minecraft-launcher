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
})

/**
 * Inferred TypeScript interface from InstanceModpackMetadataZodSchema.
 */
export type InstanceModpackMetadataSchema = z.infer<typeof InstanceModpackMetadataSchema>
