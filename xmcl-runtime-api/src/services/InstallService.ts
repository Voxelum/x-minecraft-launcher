import type { ResolvedLibrary, ResolvedVersion, Version } from '@xmcl/core'
import type {
  InstallIssue,
  InstallProfile,
  LabyModManifest,
  MinecraftTrackerEvents,
  MinecraftVersion,
  OptifineTrackerEvents,
} from '@xmcl/installer'
import {
  AssetsTrackerEvents,
  ForgeTrackerEvents,
  JavaRuntimeTrackerEvents,
  LibrariesTrackerEvents,
  ZuluTrackerEvents,
} from '@xmcl/installer'
import { OptifineVersion } from '../entities/version'
import { SubState, Task, Tasks } from '../task'
import { ServiceKey } from './Service'

export interface InstallJavaTask extends Task {
  type: 'installJre'
  version: number
  substate:
    | SubState<ZuluTrackerEvents, 'zulu-java.download'>
    | SubState<ZuluTrackerEvents, 'zulu-java.extract'>
    | SubState<JavaRuntimeTrackerEvents, 'java-runtime.file'>
    | SubState<JavaRuntimeTrackerEvents, 'java-runtime.json'>
}

export interface InstallForgeTask extends Task {
  type: 'installForge'
  version: string
  mcversion: string
  substate:
    | SubState<ForgeTrackerEvents, 'forge.installer'>
    | SubState<ForgeTrackerEvents, 'libraries'>
    | SubState<ForgeTrackerEvents, 'postprocess'>
}

export interface InstallAssetsTask extends Task {
  type: 'installAssets'
  version: string
  substate:
    | SubState<AssetsTrackerEvents, 'assets.assets'>
    | SubState<AssetsTrackerEvents, 'assets.logConfig'>
    | SubState<AssetsTrackerEvents, 'assets.assetIndex'>
}

export interface InstallLibrariesTask extends Task {
  type: 'installLibraries'
  substate: SubState<LibrariesTrackerEvents, 'libraries'>
}

export interface InstallMinecraftTask extends Task {
  type: 'installVersion'
  version: string
  substate:
    | SubState<MinecraftTrackerEvents, 'version.json'>
    | SubState<MinecraftTrackerEvents, 'version.jar'>
}

export interface InstallNeoForgeTask extends Task {
  type: 'installNeoForge'
  version: string
  minecraft: string
  substate:
    | SubState<ForgeTrackerEvents, 'forge.installer'>
    | SubState<ForgeTrackerEvents, 'libraries'>
    | SubState<ForgeTrackerEvents, 'postprocess'>
}

export interface InstallFabricTask extends Task {
  type: 'installFabric'
  loader: string
  minecraft: string
  substate: undefined
}

export interface InstallQuiltTask extends Task {
  type: 'installQuilt'
  version: string
  minecraft: string
  substate: undefined
}

export interface InstallOptifineTask extends Task {
  type: 'installOptifine'
  version: string
  minecraft: string
  substate:
    | SubState<OptifineTrackerEvents, 'optifine.unpack'>
    | SubState<LibrariesTrackerEvents, 'libraries'>
}

export interface InstallLabyModTask extends Task {
  type: 'installLabyMod'
  version: string
  minecraft: string
  substate: SubState<LibrariesTrackerEvents, 'libraries'>
}

export interface ReinstallTask extends Task {
  type: 'reinstall'
  version: string
  substate:
    | SubState<MinecraftTrackerEvents, 'version.json'>
    | SubState<ForgeTrackerEvents, 'forge.installer'>
    | SubState<ForgeTrackerEvents, 'postprocess'>
    | SubState<MinecraftTrackerEvents, 'version.jar'>
    | SubState<LibrariesTrackerEvents, 'libraries'>
    | SubState<AssetsTrackerEvents, 'assets.assets'>
    | SubState<AssetsTrackerEvents, 'assets.logConfig'>
    | SubState<AssetsTrackerEvents, 'assets.assetIndex'>
}

export interface InstallProfileTask extends Task {
  type: 'installProfile'
  version: string
  substate:
    | SubState<ForgeTrackerEvents, 'forge.installer'>
    | SubState<ForgeTrackerEvents, 'libraries'>
    | SubState<ForgeTrackerEvents, 'postprocess'>
}

interface ProgressTracker {
  url: string
  total: number
  acceptRanges: boolean
  progress: number
  speed: number
}

export function getDownloadProgress(task: Tasks): ProgressTracker | undefined {
  if ('substate' in task) {
    if (task.substate && typeof task.substate === 'object' && 'download' in task.substate) {
      return task.substate.download as ProgressTracker
    }
  }
  return undefined
}
export interface InstallOptifineOptions extends OptifineVersion {
  /**
   * Install over forge
   */
  forgeVersion?: string
  inheritFrom?: string

  java?: string
}

export interface InstallOptifineAsModOptions extends OptifineVersion {
  instancePath: string
}

export interface InstallQuiltOptions {
  /**
   * Quilt version
   */
  version: string

  minecraftVersion: string

  side?: 'client' | 'server'

  base?: string
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

  /**
   * The java path
   */
  java?: string

  side?: 'client' | 'server'

  root?: string

  base?: string
}

export interface InstallProfileOptions {
  profile: InstallProfile

  version?: string

  side?: 'client' | 'server'

  java?: string
}

export interface InstallNeoForgedOptions {
  /**
   * The minecraft version
   */
  minecraft: string
  /**
   * The forge version (without minecraft version)
   */
  version: string
  /**
   * The java path
   */
  java?: string

  side?: 'client' | 'server'

  base?: string
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

  side?: 'client' | 'server'

  base?: string
}

export type InstallableLibrary = Version.Library | ResolvedLibrary

export interface GetQuiltVersionListOptions {
  minecraftVersion?: string
  force?: boolean
}

export interface InstallLabyModOptions {
  manifest: LabyModManifest
  minecraftVersion: string
  environment?: string
}

export interface InstallAssetsForVersionOptions {
  version: string
  fallbackVersionMetadata?: MinecraftVersion[]
}

export interface InstallDependenciesOptions {
  version: string
  side?: 'client' | 'server'
}

export interface ReinstallOptions {
  version: string
  side?: 'client' | 'server'
}

export interface InstallAssetsOptions {
  assets: Asset[]
  key?: string
  force?: boolean
}

export interface InstallMinecraftOptions {
  meta: MinecraftVersion
  side?: 'client' | 'server'
}

export interface InstallMinecraftJarOptions {
  version: string
  side?: 'client' | 'server'
}

export interface InstallLibrariesOptions {
  libraries: InstallableLibrary[]
  version?: string
  force?: boolean
}

export interface DiagnoseOptions {
  currentVersion: ResolvedVersion
  side?: 'client' | 'server'
}

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
export interface InstallService {
  /**
   * Install assets which defined in this version asset.json. If this version is not present, this will throw error！
   *
   * Task key: Uses the version id as task key
   */
  installAssetsForVersion(options: InstallAssetsForVersionOptions): Promise<void>

  /**
   * Install libraries and assets for the version
   *
   * Task key: Uses the version id as task key
   */
  installDependencies(options: InstallDependenciesOptions): Promise<void>

  /**
   * Install labymod to a minecraft version
   *
   * Task key: Computed as `${minecraftVersion}-labymod${manifest.version}`
   */
  installLabyModVersion(options: InstallLabyModOptions): Promise<string>

  /**
   * If you think a version is corrupted, you can try to reinstall this version
   *
   * Task key: Uses the version id as task key
   */
  reinstall(options: ReinstallOptions): Promise<void>

  /**
   * Install assets to the version
   *
   * Task key: Uses the provided key or 'assets' if not specified
   */
  installAssets(options: InstallAssetsOptions): Promise<void>

  /**
   * Download and install a minecraft version
   *
   * Task key: Uses the minecraft version id (meta.id) as task key
   */
  installMinecraft(options: InstallMinecraftOptions): Promise<void>

  /**
   * Install minecraft jar to the game
   *
   * Task key: Uses the version id as task key
   */
  installMinecraftJar(options: InstallMinecraftJarOptions): Promise<void>

  /**
   * Install provided libraries to game
   *
   * Task key: Uses the provided version or 'libraries' if not specified
   */
  installLibraries(options: InstallLibrariesOptions): Promise<void>

  /**
   * Install neoForged to the minecraft
   *
   * Task key: Computed as `${minecraft}-neoforged${version}`
   */
  installNeoForged(options: InstallNeoForgedOptions): Promise<string>

  /**
   * Install forge by forge version metadata and minecraft
   *
   * Task key: Computed as `${mcversion}-forge${version}`
   */
  installForge(options: InstallForgeOptions): Promise<string>

  /**
   * Install fabric to the minecraft
   *
   * Task key: Computed as `${minecraft}-fabric${loader}`
   */
  installFabric(options: InstallFabricOptions): Promise<string>

  /**
   * Install the optifine to the minecraft
   *
   * Task key: Computed as `${mcversion}-optifine${type}_${patch}`
   */
  installOptifine(options: InstallOptifineOptions): Promise<string>

  /**
   * Install the optifine universal jar as a mod
   *
   * Task key: Not applicable - this installs to an instance, not a version
   */
  installOptifineAsMod(options: InstallOptifineAsModOptions): Promise<void>

  /**
   * Install quilt to the minecraft
   *
   * Task key: Computed as `${minecraftVersion}-quilt${version}`
   */
  installQuilt(options: InstallQuiltOptions): Promise<string>

  /**
   * Install by a custom install profile
   *
   * Task key: Uses the provided version or profile.version as task key
   */
  installByProfile(options: InstallProfileOptions): Promise<void>

  /**
   * Diagnose if the version has any missing or corrupted files
   *
   * Task key: Not applicable - this is a diagnostic method
   */
  diagnose(options: DiagnoseOptions): Promise<InstallIssue | undefined>
}

export const InstallServiceKey: ServiceKey<InstallService> = 'InstallService'
