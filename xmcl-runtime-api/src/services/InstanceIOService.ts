import { Exception, InstanceNotFoundException } from '../entities/exception'
import { InstanceManifest, InstanceManifestSchema, InstanceFile } from '../entities/instanceManifest.schema'
import { ServiceKey } from './Service'

export interface ExportInstanceOptions {
  /**
   * The src path of the instance
   */
  src?: string
  /**
   * The dest path of the exported instance
   */
  destinationPath: string
  /**
   * Does this export include the libraries?
   * @default true
   */
  includeLibraries?: boolean
  /**
   * Does this export includes assets?
   * @default true
   */
  includeAssets?: boolean
  /**
   * Does this export includes the minecraft version jar? (like <minecraft>/versions/1.14.4.jar).
   * If this is false, then it will only export with version json.
   * @default true
   */
  includeVersionJar?: boolean
  /**
   * If this is present, it will only exports the file paths in this array.
   * By default this is `undefined`, and it will export everything in the instance.
   */
  files?: string[]
}

export interface InstanceUpdate {
  /**
   * The differences between the remote instance manifest and current instance.
   */
  updates: Array<{
    /**
     * Either or add or update the file
     */
    operation: 'update' | 'add'
    /**
     * The file need to apply update
     */
    file: InstanceFile
  }>
  /**
   * The instance manifest return by the remote api server
   */
  manifest: InstanceManifestSchema
}

export interface InstallInstanceOptions {
  /**
   * The instance path
   */
  path?: string
  /**
   * The files to update
   */
  files: Array<InstanceFile>
  /**
   * Generate the lock of the instance
   */
  lock?: boolean
}

export interface GetManifestOptions {
  /**
   * The instance path
   *
   * If this does not present, it will be the current selected instance
   */
  path?: string
  /**
   * The hash to get for each instance files
   */
  hashes?: string[]
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
export interface InstanceIOService {
  /**
   * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
   * @param options The export instance options
   */
  exportInstance(options: ExportInstanceOptions): Promise<void>
  /**
   * Import an instance from a game zip file or a game directory. The location root must be the game directory.
   * @param location The zip or directory path
   * @returns The newly created instance path
   */
  importInstance(location: string): Promise<string>
  /**
   * Compute the instance manifest for current local files.
   */
  getInstanceManifest(options?: GetManifestOptions): Promise<InstanceManifest>
}

export type InstanceIOExceptions = InstanceNotFoundException | {
  type: 'instanceHasNoFileApi'
  instancePath: string
} | {
  type: 'instanceInvalidFileApi'
  instancePath: string
  url: string
} | {
  type: 'instanceSetManifestFailed'
  statusCode: number
  httpBody: any
} | {
  /**
   * This mean the server return 404 or error
   */
  type: 'instanceNotFoundInApi'
  url: string
  statusCode?: number
}

export class InstanceIOException extends Exception<InstanceIOExceptions> {

}

export const InstanceIOServiceKey: ServiceKey<InstanceIOService> = 'InstanceIOService'
