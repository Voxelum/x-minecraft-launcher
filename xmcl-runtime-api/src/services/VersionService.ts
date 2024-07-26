import type { ResolvedVersion } from '@xmcl/core'
import { ServiceKey } from './Service'
import { MutableState } from '../util/MutableState'
import { LocalVersions, ResolvedServerVersion } from '../entities/version'

/**
 * The local version service maintains the installed versions on disk
 */
export interface VersionService {
  getLocalVersions(): Promise<MutableState<LocalVersions>>
  /**
   * Scan .minecraft folder and copy libraries/assets/versions files from it to launcher managed place.
   *
   * This will not replace the existed files
   */
  migrateMinecraftFile(): Promise<void>
  /**
   * Resolve the local version from the version folder.
   *
   * @param versionFolder The version id
   */
  resolveLocalVersion(versionFolder: string): Promise<ResolvedVersion>
  /**
   * Refresh a version in the version folder.
   * @param versionFolder The version folder name. It must existed under the `versions` folder.
   */
  refreshVersion(versionFolder: string): Promise<void>
  refreshVersions(force?: boolean): Promise<void>

  resolveServerVersion(id: string): Promise<ResolvedServerVersion>
  /**
   * Delete a local version
   * @param version The version id
   */
  deleteVersion(version: string): Promise<void>
  /**
   * Show the `.minecraft/versions` folder
   */
  showVersionsDirectory(): Promise<boolean>
  /**
   * Show a specific version directory
   * @param version The version to show
   */
  showVersionDirectory(version: string): Promise<boolean>
}

export const VersionServiceKey: ServiceKey<VersionService> = 'VersionService'
