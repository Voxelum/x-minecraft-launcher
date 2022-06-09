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

export interface SetInstanceManifestOptions {
  /**
   * The path of the instance
   */
  path?: string
  /**
   * The manifest to upload
   */
  manifest: InstanceManifestSchema
  /**
   * The headers used to send to the server.
   *
   * By default, it will add an `Authorization` header with Microsoft account access token if this is empty.
   */
  headers?: Record<string, string>
  /**
   * Should we upload the file has downloads/curseforge/modrinth info?
   *
   * By default, if the file has curseforge/modrinth/downloads info, it will not be uploaded to the server.
   *
   * @default false
   */
  includeFileWithDownloads?: boolean
  /**
   * Force to use json format to upload to server.
   *
   * Some servers do not accept the files without downloads/curseforge/modrinth info. So this might failed on that server.
   * @default false
   */
  forceJsonFormat?: boolean
}

export interface ApplyInstanceUpdateOptions {
  /**
   * The instance path
   */
  path?: string
  /**
   * The files to update
   */
  updates: Array<InstanceFile>
}

export interface GetManifestOptions<T extends 'sha1' | 'sha256' | 'md5'> {
  /**
   * The instance path
   *
   * If this does not present, it will be the current selected instance
   */
  path?: string
  /**
   * The hash to get for each instance files
   */
  hashes?: T[]
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
   * Fetch the instance update and return the difference.
   * If this instance is not a remote hooked instance, this will return
   */
  fetchInstanceUpdate(path?: string): Promise<InstanceUpdate | undefined>
  /**
   * Compute the instance manifest for current local files.
   */
  getInstanceManifest<T extends 'sha1' | 'sha256' | 'md5' = never>(options?: GetManifestOptions<T>): Promise<InstanceManifest<T>>
  /**
   * Upload the instance manifest via `instance.fileApi`
   *
   * This will send http post request to the `instance.fileApi` URL.
   * - If all the files manifest in options has downloads/curseforge/modrinth info, it will POST a json manifest (`content-type: application/json`) to the server.
   * - If some files in manifest has no downloads/curseforge/modrinth info, it will POST a zip file (`content-type: application/zip`) to the server.
   *
   * Normally, you must have admin privilege to call this method.
   * Set the `headers` in options to add auth info in http headers.
   */
  uploadInstanceManifest(options: SetInstanceManifestOptions): Promise<void>
  /**
   * Apply the instance files update.
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
   * This will only download modified file
   */
  applyInstanceFilesUpdate(options: ApplyInstanceUpdateOptions): Promise<void>
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
