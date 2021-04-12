import type { ResolvedLibrary, Version } from '@xmcl/core'
import type { installForgeTask, LiteloaderVersion, MinecraftVersion } from '@xmcl/installer'
import { OptifineVersion } from '../entities/version.schema'
import { ServiceKey } from './Service'

export interface InstallOptifineOptions extends OptifineVersion {
  inhrenitFrom?: string
}
/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
export interface InstallService {
  /**
   * Request minecraft version list and cache in to store and disk.
   */
  refreshMinecraft(force?: boolean): Promise<void>
  /**
   * Install assets which defined in this version asset.json. If this version is not present, this will throw error！
   * @param version The local version id
   */
  installAssetsForVersion(version: string): Promise<void>
  installDependencies(version: string): Promise<void>
  /**
   * If you think a version is corrupted, you can try to reinstall this version
   * @param version The version to reinstall
   */
  reinstall(version: string): Promise<void>
  /**
   * Install assets to the version
   * @param version The local version id
   */
  installAssets(assets: {
    name: string
    size: number
    hash: string
  }[]): Promise<void>
  /**
   * Download and install a minecract version
   */
  installMinecraft(meta: MinecraftVersion): Promise<void>
  /**
   * Install provided libraries to game.
   */
  installLibraries({ libraries }: {
    libraries: (Version.Library | ResolvedLibrary)[]
  }): Promise<void>
  /**
   * Refresh forge remote versions cache from forge websites or BMCL API
   */
  refreshForge(options?: {
    force?: boolean
    mcversion?: string
  }): Promise<void>
  /**
   * Install forge by forge version metadata
   */
  installForge(meta: Parameters<typeof installForgeTask>[0]): Promise<string | undefined>
  /**
   * Refresh fabric version list in the store.
   * @param force shouls the version be refresh regardless if we have already refreshed fabric version.
   */
  refreshFabric(force?: boolean): Promise<void>
  /**
   * Install fabric to the minecraft
   * @param versions The fabric versions
   */
  installFabric(versions: {
    yarn?: string
    loader: string
    minecraft: string
  }): Promise<string | undefined>
  /**
   * Refresh optifine version list from BMCL API
   */
  refreshOptifine(force?: boolean): Promise<void>
  /**
   * Install the optifine to the minecraft
   */
  installOptifine(options: InstallOptifineOptions): Promise<string>
  /**
   * Refresh the listloader version list from its github
   */
  refreshLiteloader(force?: boolean): Promise<void>
  /**
   * Install a specific liteloader version
   */
  installLiteloader(meta: LiteloaderVersion): Promise<void>
}

export const InstallServiceKey: ServiceKey<InstallService> = 'InstallService'
