import type { JavaVersion, ResolvedLibrary, ResolvedVersion, Version } from '@xmcl/core'
import type { Java } from '../entities/java.schema'
import type {
  InstanceVersionInstallResult,
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
  /**
   * Whether to install the Minecraft jar after resolving the version JSON.
   * @default true
   */
  installJar?: boolean
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
  /** Version id to inspect. The returned issue is advisory UI state only. */
  version: string
  side: 'client' | 'server'
}

export interface MarkVersionInstallationOptions {
  version: string
  timestamp: number
}

/**
 * Version install service provide some functions to install Minecraft/Forge/Liteloader, etc. version
 */
export type VersionInstallRequest =
  | {
      type: 'instance'
      instancePath: string
      runtime: import('@xmcl/instance').PartialRuntimeVersions
      selectedVersion?: string
    }
  | { type: 'server'; runtime: import('@xmcl/instance').RuntimeVersions; path: string }
  | { type: 'repair'; version: string; side: 'client' | 'server' }
  | { type: 'reinstall'; version: string; side?: 'client' | 'server' }
  | { type: 'java'; target: JavaVersion; forceZulu?: boolean }
  | { type: 'optifine-mod'; options: InstallOptifineAsModOptions }

export interface VersionInstallService {
  /**
   * Resolve metadata, diagnose current files, compile staged plans, and execute
   * them in one main-process operation. Diagnosis results are never accepted as
   * input because they may be stale by the time installation starts.
   */
  install(request: Extract<VersionInstallRequest, { type: 'instance' }>): Promise<InstanceVersionInstallResult>
  installInstance(request: Extract<VersionInstallRequest, { type: 'instance' }>): Promise<InstanceVersionInstallResult>
  install(request: Extract<VersionInstallRequest, { type: 'server' }>): Promise<string>
  install(request: Extract<VersionInstallRequest, { type: 'java' }>): Promise<Java>
  install(request: Extract<VersionInstallRequest, { type: 'repair' | 'reinstall' | 'optifine-mod' }>): Promise<void>
  /** Inspect current state for display. `install` always diagnoses again. */
  diagnose(options: DiagnoseOptions): Promise<InstallIssue | undefined>
}

export const VersionInstallServiceKey: ServiceKey<VersionInstallService> = 'VersionInstallService'
