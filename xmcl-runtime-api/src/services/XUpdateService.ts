import { InstanceFile, InstanceManifest } from '../entities/instanceManifest.schema'
import { ServiceKey } from './Service'

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
  manifest: InstanceManifest
}

export interface SetInstanceManifestOptions {
  /**
   * The path of the instance
   */
  path?: string
  /**
   * The manifest to upload
   */
  manifest: InstanceManifest
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

export interface XUpdateService {
  /**
   * Fetch the instance update and return the difference.
   * If this instance is not a remote hooked instance, this will return
   */
  fetchInstanceUpdate(path?: string): Promise<InstanceUpdate | undefined>
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
}

export const XUpdateServiceKey: ServiceKey<XUpdateService> = 'XUpdateService'
