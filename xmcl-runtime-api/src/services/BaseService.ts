import { Exception } from '../entities/exception'
import { LauncherProfile } from '../entities/launcherProfile'
import { Platform } from '../entities/platform'
import { Settings } from '../entities/setting'
import { MutableState } from '../util/MutableState'
import { ServiceKey } from './Service'

export interface MigrateOptions {
  destination: string
}

export class LauncherProfileState implements LauncherProfile {
  profiles = {}
  clientToken = ''
  authenticationDatabase = {}
  settings = {}
  selectedUser = {}
}

export interface Environment extends Platform {
  /**
   * The container of the launcher. Will be raw if the launcher is just installed on system. Will be appx if it's appx.
   */
  env: 'raw' | 'appx' | 'appimage' | string
  /**
   * The version of the launcher
   */
  version: string
  /**
   * The current build number
   */
  build: number
}

export interface PoolStats {
  connected: number
  free: number
  pending: number
  queued: number
  running: number
  size: number
}

export interface BaseService {
  getNetworkStatus(): Promise<Record<string, PoolStats>>

  destroyPool(origin: string): Promise<void>

  validateDataDictionary(path: string): Promise<undefined | 'noperm' | 'bad' | 'nondictionary' | 'exists'>

  getSessionId(): Promise<string>

  getSettings(): Promise<MutableState<Settings>>
  /**
   * Get the environment of the launcher
   */
  getEnvironment(): Promise<Environment>
  /**
   * let the launcher to handle a url open. The url can be xmcl:// protocol
   */
  handleUrl(url: string): Promise<boolean>
  /**
   * A electron provided function to show item in directory
   * @param path The path to the file item
   */
  showItemInDirectory: (path: string) => void
  /**
   * A safe method that only open directory. If the `path` is a file, it won't execute it.
   * @param path The directory path.
   */
  openDirectory: (path: string) => Promise<boolean>
  /**
   * Quit and install the update once the update is ready
   */
  quitAndInstall(): Promise<void>
  /**
   * Check launcher update.
   */
  checkUpdate(): Promise<void>
  /**
   * Download the update if there is available update
   */
  downloadUpdate(): Promise<void>
  /**
   * Quit the launcher
   */
  quit(): void
  /**
   * Exit the launcher with code
   * @param code The code number
   */
  exit(code?: number | undefined): void
  /**
   * Generate a report file
   */
  reportItNow(options: { destination: string }): Promise<void>
  /**
   * Get the game data directory folder.
   */
  getGameDataDirectory(): Promise<string>
  /**
   * Migrate the launcher game data root to another directory
   * @param options The migration options
   */
  migrate(options: MigrateOptions): Promise<void>

  getMemoryStatus(): Promise<{ total: number; free: number }>
}

export type BaseServiceExceptions = {
  /**
   * Throw when dest is a file
   */
  type: 'migrationDestinationIsFile'
  destination: string
} | {
  /**
   * Throw when dest is a dir but not empty.
   */
  type: 'migrationDestinationIsNotEmptyDirectory'
  destination: string
} | {
  /**
   * Throw rename has no permission.
   */
  type: 'migrationNoPermission'
  source: string
  destination: string
}

export class BaseServiceException extends Exception<BaseServiceExceptions> { }

export const BaseServiceKey: ServiceKey<BaseService> = 'BaseService'
