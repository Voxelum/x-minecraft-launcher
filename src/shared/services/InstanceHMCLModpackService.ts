import { ServiceKey } from './Service'

export interface ImportHMCLModpackOptions {
  /**
   * The path of HMCL modpack zip file
   */
  path: string
}
/**
 * Provide the abilities to import/export instance from/to modpack
 */
export interface InstanceHMCLModpackService {
  /**
   * Import an instance from a game zip file or a game directory. The location root must be the game directory.
   * @returns The instance path this modpack is import to
   */
  importHMCLModpack(options: ImportHMCLModpackOptions): Promise<string>
  /**
   * If current selected instance is managed by hmcl modpack, then it will refresh current server-manifest.json and update.
   */
  refresh(): Promise<void>
  /**
   * If current selected instance is managed by hmcl modpack and has update,
   * then it will update current modpack content by server-manifest.json.
   */
  updateModpack(): Promise<void>
}

export const InstanceHMCLModpackServiceKey: ServiceKey<InstanceHMCLModpackService> = 'InstanceHMCLModpackService'
