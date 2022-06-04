import { Exception } from '../entities/exception'
import { SourceInformation } from '../entities/resource'
import { EditInstanceOptions } from './InstanceService'
import { ServiceKey } from './Service'
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
   * An list of files should be included in overrides
   */
  overrides: string[]
  /**
   * For modrinth modpack only.
   * @see https://docs.modrinth.com/docs/modpacks/format_definition/#server-overrides
   */
  serverOverrides?: string[]
  /**
   * For modrinth modpack only.
   * @see https://docs.modrinth.com/docs/modpacks/format_definition/#client-overrides
   */
  clientOverrides?: string[]
  /**
   * A list of files that want to export as link (curseforge or modrinth)
   */
  exportDirectives: { path: string; exportAs: 'modrinth' | 'curseforge' }[]
  /**
   * The instance path to be exported
   */
  instancePath?: string
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
   * If this is true
   */
  emitModrinth?: boolean
}

export type ImportModpackOptions = ImportModpackToInstanceOptions | ImportModpackCreateInstanceOptions

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

  instanceConfig: Omit<EditInstanceOptions, 'instancePath'>
  /**
   * Mount the instance after the modpack is imported
   */
  mountAfterSucceed?: boolean
}

/**
 * Provide the abilities to import/export instance from/to modpack file.
 * For json format modpack like FTB, you can use the `InstanceIOService`
 */
export interface ModpackService {
  /**
   * Export the instance as an curseforge modpack
   * @param options The curseforge modpack export options
   */
  exportModpack(options: ExportModpackOptions): Promise<void>
  /**
   * Import the curseforge modpack zip file to the instance.
   * @param options The options provide instance directory path and curseforge modpack zip path
   */
  importModpack(options: ImportModpackOptions): Promise<string>
}

export const ModpackServiceKey: ServiceKey<ModpackService> = 'ModpackService'

interface ModpackDownloadableFile {
  destination: string
  downloads: string[]
  hashes: Record<string, string>
  source: SourceInformation
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
