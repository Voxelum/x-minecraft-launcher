import { Exception, ExceptionBase } from '../entities/exception'
import { ServiceKey } from './Service'
import { Task } from '../task'

/**
 * The well-known package family name of the Minecraft Bedrock UWP application.
 */
export const MINECRAFT_BEDROCK_PACKAGE_FAMILY = 'Microsoft.MinecraftUWP_8wekyb3d8bbwe'

/**
 * The Microsoft Store product id of Minecraft for Windows (Bedrock Edition).
 */
export const MINECRAFT_BEDROCK_STORE_PRODUCT_ID = '9NBLGGH2JHXJ'

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
}

export interface InstallBedrockTask extends Task {
  type: 'installBedrock'
}

export interface BedrockExceptions extends ExceptionBase {
  type: 'bedrockUnsupportedPlatform' | 'bedrockNotInstalled' | 'bedrockLaunchFailed' | 'bedrockInstallFailed'
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
}

export const BedrockServiceKey: ServiceKey<BedrockService> = 'BedrockService'
