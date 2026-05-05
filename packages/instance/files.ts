import { z } from 'zod'
import {
  InstanceData,
  RuntimeVersions,
  RuntimeVersionsSchema,
  InstanceDataSchema,
} from './instance'

/**
 * Represent an instance file
 */
export const InstanceFile = z.object({
  /** The path of the file relative to the instance root */
  path: z.string(),
  /** The hash of the instance file. The sha1 is required */
  hashes: z.record(z.string(), z.string()),
  /** The download url of the instance file */
  downloads: z.array(z.string()).optional(),
  /** The associated curseforge project/file of the instance file */
  curseforge: z
    .object({
      projectId: z.number(),
      fileId: z.number(),
    })
    .optional(),
  /** The associated modrinth project/version of the instance file */
  modrinth: z
    .object({
      projectId: z.string(),
      versionId: z.string(),
    })
    .optional(),
  /** The file size in bytes */
  size: z.number().optional(),
})

export type InstanceFile = z.infer<typeof InstanceFile>

/**
 * File update operation types
 */
export type FileOperation = 'add' | 'remove' | 'keep' | 'backup-add' | 'backup-remove'

/**
 * Represents a file update operation
 */
export const InstanceFileUpdate = z.object({
  file: InstanceFile,
  operation: z.enum(['add', 'remove', 'keep', 'backup-add', 'backup-remove']),
})

export type InstanceFileUpdate = z.infer<typeof InstanceFileUpdate>

/**
 * The instance lock schema. Represent the intermediate state of the instance files.
 */
export const InstanceLockSchema = z.object({
  /** The instance lock version */
  version: z.number().default(1),
  /** The upstream data for this locked instance file state */
  upstream: z.unknown() as z.ZodType<import('./instance').InstanceUpstream>,
  /** All the files associated with current upstream */
  files: z.array(InstanceFile),
  /** The files max mtime of the last install */
  mtime: z.number(),
})

export type InstanceLockSchema = z.infer<typeof InstanceLockSchema>

/**
 * Represent a intermediate state of the instance files.
 */
export const InstanceInstallLock = InstanceLockSchema.extend({
  /** The finished files path */
  finishedPath: z.array(z.string()),
  /** The backup files path */
  backup: z.string(),
  /** The install workspace path */
  workspace: z.string(),
})

export type InstanceInstallLock = z.infer<typeof InstanceInstallLock>

const InstanceDataFieldsSchema = InstanceDataSchema.pick({
  description: true,
  minMemory: true,
  maxMemory: true,
  vmOptions: true,
  mcOptions: true,
  name: true,
})

type InstanceDataFields = Pick<
  InstanceData,
  'description' | 'minMemory' | 'maxMemory' | 'vmOptions' | 'mcOptions' | 'name'
>

/**
 * Instance manifest for sharing/syncing instances
 */
export const InstanceManifest = InstanceDataFieldsSchema.partial().extend({
  /** Runtime versions for the instance */
  runtime: RuntimeVersionsSchema,
  /** List of instance files */
  files: z.array(InstanceFile),
})

export type InstanceManifest = z.infer<typeof InstanceManifest>
