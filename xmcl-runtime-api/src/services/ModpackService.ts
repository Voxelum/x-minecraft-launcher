import { EditInstanceOptions } from './InstanceService'
import { ServiceKey } from './Service'

export interface ExportModpackOptions {
  /**
   * An list of files should be included in overrides
   */
  overrides: string[]
  /**
   * The instance path to be exported
   */
  instancePath?: string
  /**
  * The dest path of the exported instance
  */
  destinationPath: string
  name: string
  version: string
  author: string
  gameVersion: string

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
