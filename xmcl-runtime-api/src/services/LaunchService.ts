import { Exception } from '../entities/exception'
import { UserProfile } from '../entities/user.schema'
import { GenericEventEmitter } from '../events'
import { AUTHORITY_DEV } from '../util/authority'
import { ServiceKey } from './Service'

interface LaunchServiceEventMap {
  'minecraft-window-ready': { pid: number }
  'minecraft-start': {
    pid: number
    version: string
    minecraft: string
    forge: string
    fabricLoader: string
  } & LaunchOptions
  'minecraft-exit': LaunchOptions & { pid: number; code?: number; signal?: string; duration: number; crashReport?: string; crashReportLocation?: string; errorLog: string }
  'minecraft-stdout': { pid: number; stdout: string }
  'minecraft-stderr': { pid: number; stdout: string }
  'launch-performance-pre': { id: string; name: string }
  'launch-performance': { id: string; name: string; duration: number }
  'error': LaunchException | Error
}

export interface LaunchOptions {
  /**
   * The operation id for telemery
   */
  operationId?: string
  /**
   * Override selected version for current instance
   */
  version: string
  /**
   * The game directory of the minecraft
   */
  gameDirectory: string
  /**
   * Launch client or server
   */
  side?: 'client' | 'server'
  /**
   * The user to launch
   */
  user: UserProfile
  /**
   * The java exe path
   */
  java: string
  /**
   * Override the launch to server options
   */
  server?: {
    host: string
    port?: number
  }
  /**
   * Support yushi's yggdrasil agent https://github.com/to2mbn/authlib-injector/wiki
   */
  yggdrasilAgent?: {
    /**
     * The jar file path of the authlib-injector
     */
    jar: string
    /**
     * The auth server url.
     *
     * If this input is {@link AUTHORITY_DEV}. This will be resolved to the localhost yggrasil server
     */
    server: string
    /**
     * The prefetched base64
     */
    prefetched?: string
  }
  /**
   * Hide launcher after game started
   */
  hideLauncher?: boolean
  /**
   * Show log window after game started
   */
  showLog?: boolean
  /**
   * The launcher name
   */
  launcherName?: string
  /**
   * The launcher brand
   */
  launcherBrand?: string
  /**
   * The maximum memory to allocate
   */
  maxMemory?: number
  /**
   * The minimum memory to allocate
   */
  minMemory?: number
  /**
   * Skip assets check before launch
   */
  skipAssetsCheck?: boolean
  /**
   * The extra arguments for java vm
   */
  vmOptions?: string[]
  /**
   * The extra arguments for minecraft
   */
  mcOptions?: string[]
  /**
   * Prepend command before launch
   */
  prependCommand?: string
  /**
   * Command to execute before launching Minecraft
   * This will be executed before the launch process starts
   */
  preExecuteCommand?: string
  /**
   * The environment variables
   */
  env?: Record<string, string>

  disableElyByAuthlib?: boolean

  nogui?: boolean
  
  /**
   * Resolution settings for Minecraft
   */
  resolution?: { width?: number; height?: number; fullscreen?: boolean }
}

export interface GameProcess {
  pid: number
  ready: boolean
  side: 'client' | 'server'
  options: LaunchOptions
}

export interface ReportOperationPayload {
  operationId: string
  /**
   * Name of the operation
   */
  name: string
  /**
   * The duration of the operation. If empty, it means the operation is just started
   */
  duration?: number

  success?: boolean
}

export interface CreateLaunchShortcutOptions {
  instancePath: string
  userId: string
  destination: string
  icon?: string
}

export interface LaunchService extends GenericEventEmitter<LaunchServiceEventMap> {
  /**
   * Generate useable launch arguments for current profile
   */
  generateArguments(options: LaunchOptions): Promise<string[]>
  /**
   * Launch the current selected instance. This will return a boolean promise indicate whether launch is success.
   * @returns The process id. If the launch is failed, this will return undefined.
   */
  launch(options: LaunchOptions): Promise<number | undefined>
  /**
   * Kill the Minecraft process
   * @param pid The process id
   */
  kill(pid: number): Promise<void>
  /**
   * Get the game process
   * @param pid The process id
   */
  getGameProcess(pid: number): Promise<GameProcess | undefined>
  /**
   * Get all game processes
   */
  getGameProcesses(): Promise<GameProcess[]>
  /**
   * Only used for telemetry
   */
  reportOperation(options: ReportOperationPayload): Promise<void>
  /**
   * Create a launch shortcut
   */
  createLaunchShortcut(options: CreateLaunchShortcutOptions): Promise<void>
}

export type LaunchExceptions = {
  type: 'launchNoVersionInstalled'
  options?: LaunchOptions
} | {
  /**
   * Spawn process failed
   */
  type: 'launchSpawnProcessFailed'
} | {
  /**
   * Unknown java error. Might be empty java path
   */
  type: 'launchNoProperJava'
  javaPath: string
} | {
  /**
   * Java path is invalid
   */
  type: 'launchInvalidJavaPath'
  javaPath: string
} | {
  /**
   * No permission to use that java
   */
  type: 'launchJavaNoPermission'
  javaPath: string
} | {
  type: 'launchBadVersion'
  version: string
} | {
  /**
   * Pre-execute command failed
   */
  type: 'launchPreExecuteCommandFailed'
  command: string
  error?: string
}

export class LaunchException extends Exception<LaunchExceptions> { }

export const LaunchServiceKey: ServiceKey<LaunchService> = 'LaunchService'
