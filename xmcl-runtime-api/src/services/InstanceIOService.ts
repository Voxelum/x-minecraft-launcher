import { ServiceKey } from './Service'

export interface InstanceFile {
  path: string
  isDirectory: boolean
  isResource: boolean
}
export interface ExportInstanceOptions {
  /**
   * The src path of the instance
   */
  src?: string
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
export interface ImportModpackOptions {
  /**
   * The path of modpack directory
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
export interface InstanceIOService {
  /**
   * Export current instance as a modpack. Can be either curseforge or normal full Minecraft
   * @param options The export instance options
   */
  exportInstance(options: ExportInstanceOptions): Promise<void>
  /**
   * Scan all the files under the current instance.
   * It will hint if a mod resource is in curseforge
   */
  getInstanceFiles(): Promise<InstanceFile[]>
  /**
   * Link a existed instance on you disk.
   * @param path
   */
  linkInstance(path: string): Promise<boolean>
  /**
   * Import an instance from a game zip file or a game directory. The location root must be the game directory.
   * @param location The zip or directory path
   * @returns The newly created instance path
   */
  importInstance(location: string): Promise<string>
}

export const InstanceIOServiceKey: ServiceKey<InstanceIOService> = 'InstanceIOService'
