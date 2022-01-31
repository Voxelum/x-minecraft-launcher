import type { ResolvedVersion } from '@xmcl/core'
import { ServiceKey, ServiceTemplate, StatefulService } from './Service'

export class VersionState {
  /**
   * All the local versions installed in the disk
   */
  local = [] as ResolvedVersion[]
  localVersions(local: ResolvedVersion[]) {
    local.forEach(Object.freeze)
    this.local = local
  }

  localVersionAdd(local: ResolvedVersion) {
    Object.freeze(local)
    const found = this.local.findIndex(l => l.id === local.id)
    if (found !== -1) {
      this.local[found] = local
    } else {
      this.local.push(local as any)
      this.local = this.local.sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  localVersionRemove(folder: string) {
    this.local = this.local.filter(v => v.id === folder)
  }
}

/**
 * The local version serivce maintains the installed versions on disk
 */
export interface VersionService extends StatefulService<VersionState> {
  /**
   * Scan .minecraft folder and copy libraries/assets/versions files from it to launcher managed place.
   *
   * This will not replace the existed files
   */
  migrateMinecraftFile(): Promise<void>
  resolveLocalVersion(versionFolder: string, root?: string): Promise<ResolvedVersion>
  /**
     * Refresh a version in the version folder.
     * @param versionFolder The version folder name. It must existed under the `versions` folder.
     */
  refreshVersion(versionFolder: string): Promise<void>
  refreshVersions(force?: boolean): Promise<void>
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
