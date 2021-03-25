import { ServiceKey } from './Service'

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
export interface ImportCurseforgeModpackOptions {
  /**
   * The path of curseforge modpack zip file
   */
  path: string
  /**
   * The destination instance path. If this is empty, it will create a new instance.
   */
  instancePath?: string
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
