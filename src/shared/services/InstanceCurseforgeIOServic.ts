import { EditInstanceOptions } from './InstanceService'
import { ServiceKey, ServiceTemplate } from './Service'

export interface ExportCurseforgeModpackOptions {
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
}

export type ImportCurseforgeModpackOptions = ImportCurseforgeModpackToInstanceOptions | ImportCurseforgeModpackCreateInstanceOptions

export interface ImportCurseforgeModpackToInstanceOptions {
  /**
   * The path of curseforge modpack zip file
   */
  path: string
  /**
   * The destination instance path. If this is empty, it will create a new instance.
   */
  instancePath: string
}

export interface ImportCurseforgeModpackCreateInstanceOptions {
  /**
   * The path of curseforge modpack zip file
   */
  path: string

  instanceConfig: Omit<EditInstanceOptions, 'instancePath'>
}

/**
 * Provide the abilities to import/export instance from/to modpack
 */
export interface InstanceCurseforgeIOService {
  /**
   * Export the instance as an curseforge modpack
   * @param options The curseforge modpack export options
   */
  exportCurseforgeModpack(options: ExportCurseforgeModpackOptions): Promise<void>
  /**
   * Import the curseforge modpack zip file to the instance.
   * @param options The options provide instance directory path and curseforge modpack zip path
   */
  importCurseforgeModpack(options: ImportCurseforgeModpackOptions): Promise<string>
}

export const InstanceCurseforgeIOServiceKey: ServiceKey<InstanceCurseforgeIOService> = 'InstanceCurseforgeIOService'
export const InstanceCurseforgeIOServiceMethods: ServiceTemplate<InstanceCurseforgeIOService> = {
  exportCurseforgeModpack: undefined,
  importCurseforgeModpack: undefined
}
