/* eslint-disable no-redeclare */
import type { InstanceSchema as IInstanceSchema, InstanceFile, InstanceUpstream } from '@xmcl/instance'
import _InstanceInstallLockSchema from './InstanceInstallLockSchema.json'
import _InstanceLockSchema from './InstanceLockSchema.json'
import _InstanceSchema from './InstanceSchema.json'
import _InstancesSchema from './InstancesSchema.json'
import { Schema } from './schema'

// @ts-ignore
export const InstanceSchema: Schema<IInstanceSchema> = _InstanceSchema
export const InstancesSchema: Schema<InstancesSchema> = _InstancesSchema
export const InstanceLockSchema: Schema<InstanceLockSchema> = _InstanceLockSchema
export const InstanceInstallLockSchema: Schema<InstanceInstallLockSchema> = _InstanceInstallLockSchema

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

// @ts-ignore
export type { IInstanceSchema as InstanceSchema }