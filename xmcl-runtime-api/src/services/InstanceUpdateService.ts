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
  instancePath?: string
  oldModpack?: string
  newModpack: string
}

export interface InstanceUpdateProfile {
  instance: EditInstanceOptions
  files: InstanceFileUpdate[]
}

export type InstanceFileUpdate = {
  file: InstanceFile
  operation: 'add' | 'remove' | 'keep'
} | {
  file: InstanceFile
  currentFile: InstanceFile
  operation: 'backup-add' | 'backup-remove'
}

export interface InstanceUpdateService {
  getInstanceUpdateProfile(options: UpgradeModpackOptions): Promise<InstanceUpdateProfile>

  // updateInstance(options: UpdateInstanceOptions): Promise<void>
}

export const InstanceUpdateServiceKey: ServiceKey<InstanceUpdateService> = 'InstanceUpdateService'
