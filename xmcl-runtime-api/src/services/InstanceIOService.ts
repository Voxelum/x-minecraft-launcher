import { InstanceFile } from '../entities/instanceManifest.schema'
import { Exception, InstanceNotFoundException } from '../entities/exception'
import { CreateInstanceOption } from './InstanceService'
import { ServiceKey } from './Service'
import { LaunchOptions } from './LaunchService'

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

export interface ThirdPartyLauncherManifest {
  instances: {
    path: string
    options: CreateInstanceOption
  }[]

  folder: {
    versions: string
    libraries: string
    assets: string
    jre?: string
  }
}

export interface CreateInstanceManifest {
  options: CreateInstanceOption
  isIsolated: boolean
  path: string
}

export type InstanceType = 'mmc' | 'vanilla' | 'modrinth' | 'curseforge'


export type SSHCredentials = {
  password: string
} | {
  /**
   * The private key path
   */
  privateKey: string
  passphrase?: string
}

export interface ExportInstanceAsServerOptions {
  output: {
    type: 'folder'
    path: string
  } | {
    type: 'ssh'
    host: string
    port: number
    username: string
    path: string
    credentials: SSHCredentials
  }
  /**
   * The launch options
   */
  options: LaunchOptions
  /**
   * The instance files
   */
  files: InstanceFile[]
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

  getGameDefaultPath(type?: 'modrinth' | 'modrinth-instances' | 'curseforge' | 'vanilla'): Promise<string>
  /**
   * Parse other launcher data folder to get the instances
   */
  parseLauncherData(path: string, type?: InstanceType): Promise<ThirdPartyLauncherManifest>
  /**
   * Import the launcher data to the instance
   * @param path The path of the launcher data
   * @param data The data from the launcher
   */
  importLauncherData(data: ThirdPartyLauncherManifest): Promise<void>
  /**
   * Parse the files from the path of instance or .minecraft folder
   * @param path The instance or .minecraft folder path
   * @param type Determine if this is a vanilla, mmc or modrinth folder
   */
  parseInstanceFiles(path: string, type?: InstanceType): Promise<InstanceFile[]>
  /**
   * Export instance as server
   */
  exportInstanceAsServer(options: ExportInstanceAsServerOptions): Promise<void>
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
