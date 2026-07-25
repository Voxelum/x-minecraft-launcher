import { Exception, InstanceNotFoundException } from '../entities/exception'
import { ServiceKey } from './Service'
import { LaunchOptions } from './LaunchService'
import type { SharedHostingDeployment } from './SharedHostingDeploymentService'
import type {
  CreateInstanceOptions,
  InstanceFile,
  LocalServerBundleMetadata,
  ServerBundlePreflight,
  SharedRuntimeCatalog,
  XmclServerBundleManifest,
} from '@xmcl/instance'

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
    options: CreateInstanceOptions
  }[]

  folder: {
    versions: string
    libraries: string
    assets: string
    jre?: string
  }
}

export interface CreateInstanceManifest {
  options: CreateInstanceOptions
  isIsolated: boolean
  path: string
}

export type InstanceType = 'mmc' | 'vanilla' | 'modrinth' | 'curseforge' | 'prism'


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

export interface ExportInstanceForSharedHostingOptions {
  /**
   * The resolved, working client instance launch options. They locate the
   * instance and version metadata only; Java paths, JVM arguments, and server
   * launch settings are never read into the shared-hosting contract.
   */
  options: LaunchOptions
  instanceName: string
  outputPath: string
  runtimeCatalog: SharedRuntimeCatalog
  includeServerRelevantResourcePacks?: boolean
  acknowledgeWarnings?: boolean
}

export interface SharedHostingBundlePreview {
  metadata: LocalServerBundleMetadata
  preflight: ServerBundlePreflight
}

export interface SharedHostingBundleExport extends SharedHostingBundlePreview {
  outputPath: string
  archiveSha256: string
  archiveSizeBytes: number
  manifest: XmclServerBundleManifest
}

export interface DeployInstanceToSharedHostingOptions {
  options: LaunchOptions
  instanceName: string
  serviceId: string
  runtimeCatalog: SharedRuntimeCatalog
  includeServerRelevantResourcePacks?: boolean
  acknowledgeWarnings: true
  idempotencyKey: string
}


/**
 * Provide the abilities to import/export instance from/to modpack
 */
export interface InstanceIOService {
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
  /**
   * Creates a deterministic `.xmcl-server-bundle` for the authenticated
   * shared-hosting upload flow. It never exports `server.sh` or local Java.
   */
  previewInstanceForSharedHosting(options: Omit<ExportInstanceForSharedHostingOptions, 'outputPath' | 'acknowledgeWarnings'>): Promise<SharedHostingBundlePreview>
  exportInstanceForSharedHosting(options: ExportInstanceForSharedHostingOptions): Promise<SharedHostingBundleExport>
  /**
   * Creates and uploads one temporary bundle through the main-process-only
   * signed-upload service, then removes that local archive.
   */
  deployInstanceToSharedHosting(options: DeployInstanceToSharedHostingOptions): Promise<SharedHostingDeployment>
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
