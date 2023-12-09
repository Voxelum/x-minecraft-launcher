import { InstanceFile } from '../entities/instanceManifest.schema'
import { Exception, InstanceNotFoundException } from '../entities/exception'
import { CreateInstanceOption } from './InstanceService'
import { ServiceKey } from './Service'

export interface ExportInstanceOptions {
  /**
   * The src path of the instance
   */
  src: string
  /**
   * The version of the instance
   */
  version: string
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

export interface CreateInstanceManifest {
  options: CreateInstanceOption
  isIsolated: boolean
  path: string
}

export type InstanceType = 'mmc' | 'vanilla' | 'modrinth'

/**
 * Provide the abilities to import/export instance from/to modpack
 */
export interface InstanceIOService {
  /**
   * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
   * @param options The export instance options
   */
  exportInstance(options: ExportInstanceOptions): Promise<void>

  getGameDefaultPath(type?: 'modrinth-root' | 'modrinth-instances' | 'vanilla'): Promise<string>
  parseInstances(path: string, type?: InstanceType): Promise<CreateInstanceManifest[]>
  parseInstanceFiles(instancePath: string, type?: InstanceType): Promise<InstanceFile[]>
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
