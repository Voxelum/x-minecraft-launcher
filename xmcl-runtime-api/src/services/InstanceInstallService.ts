import { Exception, InstanceNotFoundException } from '../entities/exception'
import { InstanceFile } from '../entities/instanceManifest.schema'
import { ServiceKey } from './Service'

export type InstanceFileOperation = 'remove' | 'add' | 'backup-add' | 'backup-remove'
export type InstanceFileWithOperation = InstanceFile & { operation?: InstanceFileOperation }

export interface InstallInstanceOptions {
  /**
   * The instance path
   */
  path: string
  /**
   * The files to update
   */
  files: Array<InstanceFileWithOperation>
  /**
   * Generate the lock of the instance
   */
  lock?: boolean
  /**
   * Passed into task to identify the task
   */
  id?: string
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
export interface InstanceInstallService {
  /**
   * Install the instance files.
   *
   * You can use this function to ensure the files in this instance matched with your files manifest,
   *
   * like the files under
   * - mods
   * - configs
   * - resourcepacks
   * - shaderpacks
   * or any other files
   */
  installInstanceFiles(options: InstallInstanceOptions): Promise<void>
  /**
   * Check if this instance has any pending install
   *
   * @param path The instance path
   * @return All pending instance installation
   */
  checkInstanceInstall(path: string): Promise<InstanceFileWithOperation[]>
}

export type InstanceInstallExceptions = InstanceNotFoundException

export class InstanceInstallException extends Exception<InstanceInstallExceptions> {
}

export const InstanceInstallServiceKey: ServiceKey<InstanceInstallService> = 'InstanceInstallService'
