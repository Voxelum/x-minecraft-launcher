import { Exception, ExceptionBase } from '../entities/exception'
import { ServiceKey } from './Service'
import { Task } from '../task'

/**
 * The well-known package family name of the Minecraft Bedrock UWP application.
 */
export const MINECRAFT_BEDROCK_PACKAGE_FAMILY = 'Microsoft.MinecraftUWP_8wekyb3d8bbwe'

/**
 * The well-known package family name of the Minecraft Bedrock Preview UWP application.
 */
export const MINECRAFT_BEDROCK_PREVIEW_PACKAGE_FAMILY = 'Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe'

/**
 * The Microsoft Store product id of Minecraft for Windows (Bedrock Edition).
 */
export const MINECRAFT_BEDROCK_STORE_PRODUCT_ID = '9NBLGGH2JHXJ'

/**
 * The release channel of a Bedrock version.
 * - `release`: the public stable build, downloadable anonymously.
 * - `beta`: an opt-in beta build; downloading requires a Microsoft account
 *   subscribed to the Minecraft beta programme.
 * - `preview`: the Minecraft Preview app (separate package family); also
 *   requires a subscribed Microsoft account.
 */
export type BedrockVersionType = 'release' | 'beta' | 'preview'

/**
 * A downloadable Minecraft Bedrock version, resolved from the version database.
 */
export interface BedrockVersion {
  /**
   * The version string, e.g. `1.21.0.0`.
   */
  version: string
  /**
   * The Windows Update `UpdateID` (a GUID) used to resolve the package
   * download URL from the Microsoft FE3 delivery service.
   */
  updateIdentity: string
  /**
   * The release channel of this version.
   */
  type: BedrockVersionType
}

/**
 * A Bedrock version that has been downloaded and extracted locally so it can be
 * registered/switched to without re-downloading.
 */
export interface BedrockInstalledVersion {
  /**
   * The version string, e.g. `1.21.0.0`.
   */
  version: string
  /**
   * The release channel of this version.
   */
  type: BedrockVersionType
  /**
   * The absolute path of the extracted package directory (contains
   * `AppxManifest.xml`).
   */
  path: string
  /**
   * Whether this extracted version is the one currently registered with
   * Windows (i.e. the one that launches). Only one version per package family
   * can be registered at a time.
   */
  active: boolean
}

/**
 * The installation status of the Minecraft Bedrock UWP package.
 */
export interface BedrockInstallation {
  /**
   * Whether the Minecraft Bedrock UWP package is currently installed for the user.
   */
  installed: boolean
  /**
   * The installed package version, e.g. `1.21.0.0`. Empty when not installed.
   */
  version: string
  /**
   * The full package name reported by the OS, e.g.
   * `Microsoft.MinecraftUWP_1.21.0.0_x64__8wekyb3d8bbwe`. Empty when not installed.
   */
  packageFullName: string
  /**
   * The Application User Model ID used to activate the game, e.g.
   * `Microsoft.MinecraftUWP_8wekyb3d8bbwe!App`. Resolved from the package
   * manifest so it works for Store, Preview and side-loaded (registered)
   * packages. Empty when not installed.
   */
  aumid: string
}

/**
 * User-writable directories for the currently registered Bedrock UWP package.
 * These paths are distinct from the package install location, which is usually
 * protected by Windows and unsuitable for launcher actions.
 */
export interface BedrockStoragePaths {
  /** UWP LocalState directory containing Bedrock's user data. */
  dataPath: string
  /** Bedrock log directory, or LocalState when no log directory exists yet. */
  logsPath: string
}

export interface InstallBedrockTask extends Task {
  type: 'installBedrock'
}

export interface InstallBedrockVersionTask extends Task {
  type: 'installBedrockVersion'
  version: string
}

export interface BedrockExceptions extends ExceptionBase {
  type: 'bedrockUnsupportedPlatform' | 'bedrockNotInstalled' | 'bedrockLaunchFailed' | 'bedrockInstallFailed'
  /**
   * Registering an extracted (loose/unsigned) package requires Windows
   * Developer Mode to be enabled.
   */
  | 'bedrockDeveloperModeRequired'
  /**
   * Failed to resolve the download URL from the Microsoft delivery service.
   * For beta/preview versions this usually means the signed-in Microsoft
   * account is not subscribed to the beta programme.
   */
  | 'bedrockDownloadUrlUnavailable'
  /**
   * Failed to register the extracted package with Windows.
   */
  | 'bedrockRegisterFailed'
  /**
   * The requested version was not found in the local extracted versions.
   */
  | 'bedrockVersionNotFound'
}

export class BedrockException extends Exception<BedrockExceptions> {
  name = 'BedrockException'
}

export interface BedrockService {
  /**
   * Whether the current platform supports Minecraft Bedrock Edition.
   * Bedrock is only supported on the Windows build.
   */
  isSupported(): Promise<boolean>

  /**
   * Query the local installation status of the Minecraft Bedrock UWP package.
   */
  getInstallation(): Promise<BedrockInstallation>

  /**
   * Get the writable UWP data and log directories for the installed Bedrock
   * package. Returns undefined when Bedrock is unavailable or not installed.
   */
  getStoragePaths(): Promise<BedrockStoragePaths | undefined>

  /**
   * Trigger the installation of Minecraft Bedrock Edition.
   *
   * This opens the Microsoft Store product page so the user can install the
   * game with their own license. Resolves once the Store has been opened.
   *
   * @throws {@link BedrockException} with type `bedrockUnsupportedPlatform` on non-Windows platforms.
   */
  install(): Promise<void>

  /**
   * Launch the installed Minecraft Bedrock Edition UWP package.
   *
   * @throws {@link BedrockException} with type `bedrockUnsupportedPlatform` on non-Windows platforms,
   * or `bedrockNotInstalled` when the package is not installed.
   */
  launch(): Promise<void>
  isRunning(): Promise<boolean>
  killGame(): Promise<void>

  /**
   * Get the list of Minecraft Bedrock versions that can be downloaded and
   * installed side-by-side.
   *
   * @param force Bypass the on-disk cache and re-fetch the version database.
   */
  getVersionList(force?: boolean): Promise<BedrockVersion[]>

  /**
   * Get the Bedrock versions that have already been downloaded and extracted
   * locally, along with which one is currently registered/active.
   */
  getInstalledVersions(): Promise<BedrockInstalledVersion[]>

  /**
   * Download the given version from the Microsoft delivery service and extract
   * it locally so it can be registered/launched. Does not register it.
   *
   * @throws {@link BedrockException} with type `bedrockDownloadUrlUnavailable`
   * when the download URL cannot be resolved (e.g. beta without a subscribed
   * account).
   */
  installVersion(version: BedrockVersion): Promise<void>

  /**
   * Remove a locally extracted version. If it is currently registered, it is
   * unregistered first.
   */
  removeVersion(version: string): Promise<void>

  /**
   * Register a locally extracted version with Windows so it becomes the active
   * (launchable) one. Unregisters whatever version of the same package family
   * was previously registered.
   *
   * @throws {@link BedrockException} with type `bedrockDeveloperModeRequired`
   * when Windows Developer Mode is not enabled, or `bedrockRegisterFailed` on
   * other registration failures.
   */
  switchVersion(version: string): Promise<void>

  /**
   * Register (if necessary) and launch a locally extracted version.
   */
  launchVersion(version: string): Promise<void>

  /**
   * Whether Windows Developer Mode (required to register loose packages) is
   * currently enabled.
   */
  isDeveloperModeEnabled(): Promise<boolean>

  /**
   * Attempt to enable Windows Developer Mode. This launches an elevated
   * (UAC-prompting) helper because the required registry key lives under
   * `HKLM`. Resolves once the elevated process exits successfully.
   */
  enableDeveloperMode(): Promise<void>
}

export const BedrockServiceKey: ServiceKey<BedrockService> = 'BedrockService'
