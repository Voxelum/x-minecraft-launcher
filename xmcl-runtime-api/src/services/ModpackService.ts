import { Exception } from '../entities/exception'
import { InstanceData, RuntimeVersions } from '../entities/instance.schema'
import { InstanceFile } from '../entities/instanceManifest.schema'
import { InstallMarketOptions } from '../entities/market'
import { ResourceMetadata, ResourceState } from '../entities/resource'
import { SharedState } from '../util/SharedState'
import { CreateInstanceOption } from './InstanceService'
import { ServiceKey } from './Service'

export interface ExportFileDirective {
  path: string
  /**
   * Force this file included as override. Otherwise, it will use `downloads` in modrinth modpack and curseforge id in curseforge modpack
   *
   * @see https://docs.modrinth.com/docs/modpacks/format_definition/#server-overrides
   * @see https://docs.modrinth.com/docs/modpacks/format_definition/#client-overrides
   */
  override?: boolean
  /**
   * The env info for modrinth modpack.
   */
  env?: {
    client?: 'required' | 'unsupported' | 'optional'
    server?: 'required' | 'unsupported' | 'optional'
  }
}
export interface ExportModpackOptions {
  /**
   * The name of the modpack.
   */
  name: string
  /**
   * The version of the modpack.
   */
  version: string
  /**
   * The author of the modpack.
   */
  author: string
  /**
   * The game version id of the modpack. You can use the `id` in `LocalVersionHeader`.
   */
  gameVersion: string
  /**
   * A list of files that want to export (curseforge or modrinth)
   */
  files: ExportFileDirective[]
  /**
   * The instance path to be exported
   */
  instancePath: string
  /**
  * The dest path of the exported instance
  */
  destinationPath: string
  /**
   * Only available for mcbbs modpack
   */
  fileApi?: string
  /**
   * Emit the curseforge format modpack
   */
  emitCurseforge?: boolean
  /**
   * Emit the mcbbs format modpack
   */
  emitMcbbs?: boolean
  /**
   * Emit the modrinth modpack (mrpack).
   */
  emitModrinth?: boolean
  /**
   * Modrinth only. This will limit the download urls from allowed domains listed in modrinth document.
   * @see https://docs.modrinth.com/docs/modpacks/format_definition/#downloads
   */
  strictModeInModrinth?: boolean
}

export type ImportModpackOptions = ImportModpackCreateInstanceOptions

export interface ImportModpackToInstanceOptions {
  /**
   * The path of curseforge modpack zip file
   */
  path: string
  /**
   * The destination instance path. If this is empty, it will create a new instance.
   */
  instancePath: string
  /**
   * Mount the instance after the modpack is imported
   */
  mountAfterSucceed?: boolean
}

export interface ImportModpackCreateInstanceOptions {
  /**
   * The path of curseforge modpack zip file
   */
  path: string

  instanceConfig: Omit<CreateInstanceOption, 'path'>
  /**
   * Mount the instance after the modpack is imported
   */
  mountAfterSucceed?: boolean
}

export interface ModpackInstallProfile {
  instance: CreateInstanceOption & {
    runtime: RuntimeVersions
  }
  files: InstanceFile[]
}

export class ModpackState {
  modpackPath: string = ''
  config!: ModpackInstallProfile['instance']

  files: InstanceFile[] = []
  ready = false

  modpackFiles(files: InstanceFile[]) {
    this.ready = true
    this.files = files
  }
}

/**
 * Provide the abilities to parse the modpack files data.
 * For json format modpack like FTB, you can use the `InstanceIOService` to do the actual install operation.
 */
export interface ModpackService {
  /**
   * Install the modpack from market to local cache.
   * @returns The installed modpack path
   */
  installModapckFromMarket(options: InstallMarketOptions): Promise<string[]>
  /**
   * Export the instance as an curseforge/modrinth/mcbbs modpack
   * @param options The curseforge/modrinth/mcbbs modpack export options
   */
  exportModpack(options: ExportModpackOptions): Promise<void>
  /**
   * Open an modpack to install. Use the `installInstanceFiles` to create an instance.
   */
  openModpack(modpackPath: string): Promise<SharedState<ModpackState>>
  /**
   * Import the modpack as an instance
   * @param modpackPath The modpack file path
   * @param iconUrl The icon url of the modpack
   * @returns The instance path
   */
  importModpack(modpackPath: string, iconUrl?: string, upstream?: InstanceData['upstream']): Promise<{
    instancePath: string
    version?: string
    runtime: RuntimeVersions
  }>
  /**
   * Show the modpack folder
   */
  showModpacksFolder(): Promise<void>

  watchModpackFolder(): Promise<SharedState<ResourceState>>

  removeModpack(path: string): Promise<void>
}

export function waitModpackFiles(modpack: SharedState<ModpackState>) {
  return new Promise<InstanceFile[]>(resolve => {
    if (modpack.ready) {
      resolve(modpack.files)
    } else {
      const onFiles = (files: InstanceFile[]) => {
        resolve(files)
        modpack.unsubscribe('modpackFiles', onFiles)
      }
      modpack.subscribe('modpackFiles', onFiles)
    }
  })
}

export const ModpackServiceKey: ServiceKey<ModpackService> = 'ModpackService'

export interface ModpackDownloadableFile {
  destination: string
  downloads: string[]
  hashes: Record<string, string>
  metadata: ResourceMetadata
}

export type ModpackExceptions = {
  type: 'invalidModpack' | 'requireModpackAFile'
  path: string
} | {
  /**
   * This is thrown when some files cannot be installed
   */
  type: 'modpackInstallFailed'
  /**
   * This is all the files
   */
  files: Array<ModpackDownloadableFile>
} | {
  /**
   * This is due to some curesforge mods disabled the thirdparty download url
   */
  type: 'modpackInstallPartial'
  /**
   * This is all the files
   */
  files: Array<ModpackDownloadableFile>
  /**
   * The curseforge files need to be manually installed
   */
  missingFiles: Array<{
    projectId: number
    fileId: number
  }>
}

export class ModpackException extends Exception<ModpackExceptions> { }
