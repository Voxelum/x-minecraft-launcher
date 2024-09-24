import { InstanceFile } from '../entities/instanceManifest.schema'
import { EditInstanceOptions } from './InstanceService'
import { ServiceKey } from './Service'

export interface UpdateInstanceOptions {
  /**
   * The instance to update
   */
  instancePath: string
}

export type UpgradeModpackOptions = {
  instancePath: string
  modpack: string
}

export type UpgradeModpackRawOptions = {
  instancePath: string
  oldVersionFiles: InstanceFile[]
  newVersionFiles: InstanceFile[]
}

export type InstanceFileUpdate = {
  file: InstanceFile
  operation: 'add' | 'remove' | 'keep'
} | {
  file: InstanceFile
  currentFile: InstanceFile
  operation: 'backup-add' | 'backup-remove'
}

export interface InstanceUpdateProfile {
  config: EditInstanceOptions
  files: InstanceFileUpdate[]
}

export interface InstanceUpdateService {
  getInstanceUpdateProfile(options: UpgradeModpackOptions): Promise<InstanceUpdateProfile>
  getInstanceUpdateProfileRaw(options: UpgradeModpackRawOptions): Promise<InstanceFileUpdate[]>
}

export const InstanceUpdateServiceKey: ServiceKey<InstanceUpdateService> = 'InstanceUpdateService'
