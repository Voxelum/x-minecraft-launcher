import type { ResolvedVersion } from '@xmcl/core'
import { ServiceKey, StatefulService } from './Service'

export interface LocalVersionHeader {
  path: string
  id: string
  inheritances: string[]
  /**
   * Minecraft version of this version. e.g. 1.7.10
   * @default ""
   */
  minecraft: string
  /**
   * Forge version of this version. e.g. 14.23.5.2838
   * @default ""
   */
  forge: string
  /**
   * Fabric loader version, e.g. 0.7.2+build.175
   * @default ""
   */
  fabric: string
  /**
   * Optifine version e.g. HD_U_F1_pre6 or HD_U_E6
   * @default ""
   */
  optifine: string
  liteloader: string
  quilt: string
}

export class VersionState {
  /**
   * All the local versions installed in the disk
   */
  local = [] as LocalVersionHeader[]

  localVersions(local: LocalVersionHeader[]) {
    local.forEach(Object.freeze)
    this.local = local
  }

  localVersionAdd(local: LocalVersionHeader) {
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
    this.local = this.local.filter(v => v.id !== folder)
  }
}

/**
 * The local version service maintains the installed versions on disk
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
