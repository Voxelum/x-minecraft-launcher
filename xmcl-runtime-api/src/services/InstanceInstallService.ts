import { SharedState } from '../util/SharedState'
import { InstanceUpstream } from '../entities/instance.schema'
import { InstanceFile } from '../entities/instanceManifest.schema'
import { ServiceKey } from './Service'

export type InstanceFileUpdate = {
  file: InstanceFile
  operation: 'add' | 'remove' | 'keep'
} | {
  file: InstanceFile
  operation: 'backup-add' | 'backup-remove'
}


export type InstallInstanceOptions = {
  /**
   * The instance path
   */
  path: string
  /**
   * The key of the file sources
   */
  upstream: InstanceUpstream
  /**
   * The files to update
   */
  files: Array<InstanceFile>
  /**s
   * Passed into task to identify the task
   */
  id?: string
} | {
  /**
   * The instance path
   */
  path: string
  /**
   * The files to be removed
   */
  oldFiles: InstanceFile[]
  /**
   * The files to add
   */
  files: InstanceFile[]
  /**s
   * Passed into task to identify the task
   */
  id?: string
}

export class InstanceInstallStatus {
  instance = ''

  pendingFileCount: number = 0
  /**
   * Unresolved files in previous install
   */
  unresolvedFiles: InstanceFile[] = []

  pendingFileCountSet(count: number) {
    this.pendingFileCount = count
  }

  unresolvedFilesSet(files: InstanceFile[]) {
    this.unresolvedFiles = files
  }
}

export type InstallFileError = {
  name: 'ChecksumNotMatchError'
  file: InstanceFile
  expect: string
  actual: string
} | {
  name: 'UnpackZipFileNotFoundError'
  file: string
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
   * 
   * Normally, you can use this to install the modpack and memorize the files with the generated lock file,
   * if the upstream is provided.
   *
   * If the upstream is not provided, it will only directly install the files into.
   * 
   * The files cannot be resolved won't fail this method, and they will be stored in the `unresolved-files.json` in the instance folder.
   * You can call the `checkInstanceInstall` to get the unresolved files.
   */
  installInstanceFiles(options: InstallInstanceOptions): Promise<void>
  /**
   * Preview the instance files update.
   */
  previewInstanceFiles(options: InstallInstanceOptions): Promise<InstanceFileUpdate[]>
  /**
   * Resume the instance installation. Usually, this method is used to resume the failed installation.
   *
   * This method might return the errors all the errors are checksum not matched.
   */
  resumeInstanceInstall(path: string, overrides?: InstanceFile[]): Promise<InstallFileError[] | void>
  /**
   * Check if this instance has any pending install
   *
   * @param path The instance path
   */
  watchInstanceInstall(path: string): Promise<SharedState<InstanceInstallStatus>>
  /**
   * Dismiss the unresolved files in the instance.
   * 
   * This method is used to remove the unresolved files as user is already handled them.
   */
  dismissUnresolvedFiles(path: string): Promise<void>
}

export const InstanceInstallServiceKey: ServiceKey<InstanceInstallService> = 'InstanceInstallService'
