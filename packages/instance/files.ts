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

/**
 * Pending file changes for an instance. The manifest is built incrementally
 * and applied as one install transaction.
 */
export const InstanceInstallManifest = z.object({
  version: z.literal(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  oldFiles: z.array(InstanceFile),
  files: z.array(InstanceFile),
})

export type InstanceInstallManifest = z.infer<typeof InstanceInstallManifest>

function getInstanceFileIdentity(file: InstanceFile) {
  if (file.modrinth) return `modrinth:${file.modrinth.projectId}`
  if (file.curseforge) return `curseforge:${file.curseforge.projectId}`
  return `path:${file.path}`
}

function upsertInstanceFile(files: InstanceFile[], file: InstanceFile) {
  const identity = getInstanceFileIdentity(file)
  const index = files.findIndex(value => value.path === file.path || getInstanceFileIdentity(value) === identity)
  if (index === -1) files.push(file)
  else files[index] = file
}

function isSameInstanceFileArtifact(left: InstanceFile, right: InstanceFile) {
  if (left.path === right.path) return true
  if (left.modrinth && right.modrinth) return left.modrinth.versionId === right.modrinth.versionId
  if (left.curseforge && right.curseforge) return left.curseforge.fileId === right.curseforge.fileId
  return false
}

export function mergeInstanceInstallManifest(
  current: InstanceInstallManifest | undefined,
  change: { oldFiles: InstanceFile[]; files: InstanceFile[] },
  now = Date.now(),
): InstanceInstallManifest {
  const oldFiles = [...(current?.oldFiles ?? [])]
  const files = [...(current?.files ?? [])]

  for (const oldFile of change.oldFiles) {
    const stagedIndex = files.findIndex(file => isSameInstanceFileArtifact(file, oldFile))
    if (stagedIndex !== -1) {
      files.splice(stagedIndex, 1)
    } else {
      upsertInstanceFile(oldFiles, oldFile)
    }
  }
  for (const file of change.files) upsertInstanceFile(files, file)

  return {
    version: 1,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    oldFiles,
    files,
  }
}

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
