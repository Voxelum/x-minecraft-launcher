/* eslint-disable no-redeclare */
import type { InstanceSchema as IInstanceSchema, InstanceFile, InstanceUpstream } from '@xmcl/instance'
import _InstanceInstallLockSchema from './InstanceInstallLockSchema.json'
import _InstanceLockSchema from './InstanceLockSchema.json'
import _InstanceSchema from './InstanceSchema.json'
import _InstancesSchema from './InstancesSchema.json'
import _InstanceModpackMetadataSchema from './InstanceModpackMetadataSchema.json'
import { Schema } from './schema'

// @ts-ignore
export const InstanceSchema: Schema<IInstanceSchema> = _InstanceSchema
export const InstancesSchema: Schema<InstancesSchema> = _InstancesSchema
export const InstanceLockSchema: Schema<InstanceLockSchema> = _InstanceLockSchema
export const InstanceInstallLockSchema: Schema<InstanceInstallLockSchema> = _InstanceInstallLockSchema
export const InstanceModpackMetadataSchema: Schema<InstanceModpackMetadataSchema> = _InstanceModpackMetadataSchema

/**
 * The instance lock schema. Represent the intermediate state of the instance files.
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface InstanceLockSchema {
  /**
   * The instance lock
   * @default 1
   */
  version: number
  /**
   * The upstream data for this locked instance file state
   */
  upstream: InstanceUpstream
  /**
   * All the files accociated with current upstream
   */
  files: InstanceFile[]
  /**
   * The files max mtime of the last install
   */
  mtime: number
}

/**
 * Represent a intermediate state of the instance files.
 */
export interface InstanceInstallLockSchema extends InstanceLockSchema {
  /**
   * The finished files path
   */
  finishedPath: string[]
  /**
   * The backup files path
   */
  backup: string
  /**
   * The install workspace path
   */
  workspace: string
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface InstancesSchema {
  /**
   * @default ""
   */
  selectedInstance: string
  /**
   * The extra imported instance path
   * @default []
   */
  instances: string[]
}

export interface InstanceModpackMetadataSchema {
  /**
   * The metadata file format
   * 
   * Now is 0
   */
  version: 0
  /**
   * The export directory for modpack files. Need to be an absolute path.
   * 
   * If this is absent, it will export to the user desktop.
   * @default ""
   */
  exportDirectory: string
  /**
   * The current modpack version. Start from 0.0.1
   * @default "0.0.1"
   */
  modpackVersion: string
  /**
   * Emit the curseforge modpack format
   * @default true
   */
  emitCurseforge: boolean
  /**
   * Emit the modrinth modpack format
   * @default true
   */
  emitModrinth: boolean
  /**
   * Emit the modrinth modpack format with strict version
   * @default true
   */
  emitModrinthStrict: boolean
  /**
   * Emit the offline format zip
   * @default false
   */
  emitOffline: boolean
  /**
   * The files to included in last export.
   * @default []
   */
  emittedFiles: string[]
}

// @ts-ignore
export type { IInstanceSchema as InstanceSchema }