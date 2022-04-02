import { Exception } from '../entities/exception'
import { EditInstanceOptions } from './InstanceService'
import { ServiceKey } from './Service'

export interface ExportModpackOptions {
  name: string
  version: string
  author: string
  gameVersion: string
  /**
   * An list of files should be included in overrides
   */
  overrides: string[]
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

  emitCurseforge?: boolean

  emitMcbbs?: boolean
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
}

export interface ImportModpackCreateInstanceOptions {
  /**
   * The path of curseforge modpack zip file
   */
  path: string

  instanceConfig: Omit<EditInstanceOptions, 'instancePath'>
}

/**
 * Provide the abilities to import/export instance from/to modpack
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

export type ModpackExceptions = {
  type: 'invalidModpack' | 'requireModpackAFile'
  path: string
}

export class ModpackException extends Exception<ModpackExceptions> { }
