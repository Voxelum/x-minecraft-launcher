import type { LabyModManifest, QuiltArtifactVersion } from '@xmcl/installer'
import { FabricVersions, ForgeVersion, LiteloaderVersions, MinecraftVersions, NeoForgedVersions, OptifineVersion } from '../entities/version'
import { ServiceKey } from './Service'

export interface VersionMetadataService {
  getLatestMinecraftRelease(): Promise<string>
  /**
   * The minecraft version list
   * Request minecraft version list and cache in to store and disk.
   */
  getMinecraftVersionList(): Promise<MinecraftVersions>
  /**
   * Refresh forge remote versions cache from forge websites or BMCL API
   */
  getForgeVersionList(minecraftVersion: string): Promise<ForgeVersion[]>
  /**
   * Get the neo forge version list
   */
  getNeoForgedVersionList(minecraftVersion: string): Promise<NeoForgedVersions>
  /**
   * Get liteloader version list in the store.
   */
  getLiteloaderVersionList(): Promise<LiteloaderVersions>
  /**
   * Refresh fabric version list in the store.
   * @param force should the version be refresh regardless if we have already refreshed fabric version.
   */
  getFabricVersionList(): Promise<FabricVersions>
  /**
   * Refresh optifine version list from BMCL API
   */
  getOptifineVersionList(): Promise<OptifineVersion[]>
  /**
   * Get the quilt version list
   */
  getQuiltVersionList(minecraftVersion?: string): Promise<QuiltArtifactVersion[]>
  /**
   * Get the labymod manifest
   */
  getLabyModManifest(): Promise<LabyModManifest>
}

export const VersionMetadataServiceKey: ServiceKey<VersionMetadataService> = 'VersionMetadataService'
