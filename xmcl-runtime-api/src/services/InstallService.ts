import type { ResolvedLibrary, Version } from '@xmcl/core'
import type { FabricArtifactVersion, InstallProfile, LiteloaderVersion, LiteloaderVersionList, MinecraftVersion, MinecraftVersionList, QuiltArtifactVersion } from '@xmcl/installer'
import { LATEST_RELEASE } from '../entities/version'
import { ForgeVersion, ForgeVersionList, OptifineVersion, VersionFabricSchema, VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema, VersionOptifineSchema } from '../entities/version.schema'
import { ServiceKey, StatefulService } from './Service'

export class InstallState {
  /**
   * Minecraft version metadata list. Helps to download.
   */
  minecraft = {
    timestamp: '',
    latest: {
      snapshot: '',
      release: '',
    },
    versions: [],
  } as VersionMinecraftSchema

  /**
    * Forge version metadata dictionary. Helps to download.
    */
  forge = [] as VersionForgeSchema
  /**
   * Liteloader version metadata list. Helps to download.
   */
  liteloader = {
    timestamp: '',
    meta: {
      description: '',
      authors: '',
      url: '',
      updated: '',
      updatedTime: 0,
    },
    versions: {},
  } as VersionLiteloaderSchema

  /**
   * Fabric version metadata dictionary. Helps to download.
   */
  fabric = {
    yarnTimestamp: '',
    loaderTimestamp: '',
    yarns: [],
    loaders: [],
  } as VersionFabricSchema

  /**
   * The optifine version list
   */
  optifine = {
    etag: '',
    versions: [],
  } as VersionOptifineSchema

  /**
    * latest snapshot
    */
  get minecraftSnapshot() {
    return this.minecraft.versions.find(v => v.id === this.minecraft.latest.snapshot)
  }

  /**
   * latest release
   */
  get minecraftRelease() {
    return this.minecraft.versions.find(v => v.id === this.minecraft.latest.release) || LATEST_RELEASE
  }

  minecraftMetadata(metadata: MinecraftVersionList) {
    this.minecraft = Object.freeze(metadata)
  }

  forgeMetadata(metadata: ForgeVersionList) {
    const existed = this.forge.find((version) => version.mcversion === metadata.mcversion)
    if (existed) {
      existed.timestamp = metadata.timestamp
      existed.versions = Object.freeze(metadata.versions) as any
    } else {
      const result = { ...metadata, versions: Object.freeze(metadata.versions) as any }
      this.forge.push(result)
    }
  }

  liteloaderMetadata(metadata: LiteloaderVersionList) {
    this.liteloader = Object.freeze(metadata)
  }

  fabricYarnMetadata({ versions, timestamp }: { versions: FabricArtifactVersion[]; timestamp: string }) {
    this.fabric.yarnTimestamp = timestamp
    this.fabric.yarns = Object.seal(versions)
  }

  fabricLoaderMetadata({ versions, timestamp }: { versions: FabricArtifactVersion[]; timestamp: string }) {
    this.fabric.loaderTimestamp = timestamp
    this.fabric.loaders = Object.seal(versions)
  }

  optifineMetadata({ versions, etag: timestamp }: VersionOptifineSchema) {
    this.optifine.versions = Object.seal(versions)
    this.optifine.etag = timestamp
  }
}

export interface InstallOptifineOptions extends OptifineVersion {
  /**
   * Install over forge
   */
  forgeVersion?: string
  inheritFrom?: string
}

export interface InstallQuiltOptions {
  /**
   * Quilt version
   */
  version: string

  minecraftVersion: string
}

export interface RefreshForgeOptions {
  force?: boolean
  mcversion: string
}

export interface Asset {
  name: string
  size: number
  hash: string
}

export interface InstallForgeOptions {
  /**
   * The installer info.
   *
   * If this is not presented, it will generate from mc version and forge version.
   */
  installer?: {
    sha1?: string
    /**
     * The url path to concat with forge maven
     */
    path: string
  }
  /**
   * The minecraft version
   */
  mcversion: string
  /**
   * The forge version (without minecraft version)
   */
  version: string
}

export interface InstallFabricOptions {
  /**
   * Forcing fabric yarn version
   */
  yarn?: string
  /**
   * The fabric loader version to install
   */
  loader: string
  /**
   * The minecraft version to install
   */
  minecraft: string
}

export type InstallableLibrary = Version.Library | ResolvedLibrary

export interface GetQuiltVersionListOptions {
  minecraftVersion?: string
  force?: boolean
}

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
export interface InstallService {
  /**
   * The minecraft version list
   * Request minecraft version list and cache in to store and disk.
   */
  getMinecraftVersionList(force?: boolean): Promise<VersionMinecraftSchema>
  /**
   * Refresh forge remote versions cache from forge websites or BMCL API
   */
  getForgeVersionList(options: { force?: boolean; minecraftVersion: string }): Promise<ForgeVersion[]>

  getLiteloaderVersionList(): Promise<VersionLiteloaderSchema>

  /**
   * Refresh fabric version list in the store.
   * @param force should the version be refresh regardless if we have already refreshed fabric version.
   */
  getFabricVersionList(force?: boolean): Promise<VersionFabricSchema>
  /**
   * Refresh optifine version list from BMCL API
   */
  getOptifineVersionList(force?: boolean): Promise<OptifineVersion[]>
  /**
   * Get the quilt version list
   */
  getQuiltVersionList(options?: GetQuiltVersionListOptions): Promise<QuiltArtifactVersion[]>
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
  installAssets(assets: Asset[]): Promise<void>
  /**
   * Download and install a minecraft version
   */
  installMinecraft(meta: MinecraftVersion): Promise<void>
  /**
   * Install provided libraries to game.
   */
  installLibraries(libraries: InstallableLibrary[]): Promise<void>
  /**
   * Install forge by forge version metadata
   */
  installForge(options: InstallForgeOptions): Promise<string | undefined>
  /**
   * Install fabric to the minecraft
   * @param options Install options for fabric
   */
  installFabric(options: InstallFabricOptions): Promise<string | undefined>
  /**
   * Install the optifine to the minecraft
   */
  installOptifine(options: InstallOptifineOptions): Promise<string>
  /**
   * Install a specific liteloader version
   */
  installLiteloader(meta: LiteloaderVersion): Promise<void>

  installQuilt(meta: InstallQuiltOptions): Promise<string>

  installByProfile(profile: InstallProfile): Promise<void>
}

export const InstallServiceKey: ServiceKey<InstallService> = 'InstallService'
