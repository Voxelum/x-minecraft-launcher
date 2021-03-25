import { ResolvedVersion } from '@xmcl/core'
import { ServiceKey } from './Service'
/**
 * The local version serivce maintains the installed versions on disk
 */
export interface VersionService {
  /**
     * Scan .minecraft folder and copy libraries/assets/versions files from it to launcher managed place.
     *
     * This will not replace the existed files
     */
  checkLocalMinecraftFiles(): Promise<void>
  resolveLocalVersion(versionFolder: string, root?: string): Promise<ResolvedVersion>
  resolveVersionId(): Promise<string>
  /**
     * Refresh a version in the version folder.
     * @param versionFolder The version folder name. It must existed under the `versions` folder.
     */
  refreshVersion(versionFolder: string): Promise<void>
  refreshVersions(force?: boolean): Promise<void>
  deleteVersion(version: string): Promise<void>
  showVersionsDirectory(): Promise<boolean>
  showVersionDirectory(version: string): Promise<boolean>
}

export const VersionServiceKey: ServiceKey<VersionService> = 'VersionService'
