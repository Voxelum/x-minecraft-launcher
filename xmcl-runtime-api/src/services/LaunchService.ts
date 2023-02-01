import { Exception } from '../entities/exception'
import { LaunchStatus } from '../entities/launch'
import { GenericEventEmitter } from '../events'
import { ServiceKey, StatefulService } from './Service'
import { UserExceptions } from './UserService'

export class LaunchState {
  status = 'idle' as LaunchStatus

  activeCount = 0

  launchCount(count: number) {
    if (count < 0) count = 0
    this.activeCount = count
  }

  launchStatus(status: LaunchStatus) {
    this.status = status
  }
}

interface LaunchServiceEventMap {
  'minecraft-window-ready': { pid?: number }
  'minecraft-start': {
    pid?: number
    version: string
    minecraft: string
    forge: string
    fabricLoader: string
  }
  'minecraft-exit': { pid?: number; code?: number; signal?: string; crashReport?: string; crashReportLocation?: string; errorLog: string }
  'minecraft-stdout': { pid?: number; stdout: string }
  'minecraft-stderr': { pid?: number; stdout: string }
  'error': LaunchException
}

export interface LaunchOptions {
  /**
   * Override selected version for current instance
   */
  version?: string
  /**
   * Override launching directory.
   *
   * By default, it will be the current selected instance directory.
   */
  gameDirectory?: string
  /**
   * The instance to launch
   */
  instance?: string
  /**
   * Override the launch to server options
   */
  server?: {
    host: string
    port?: number
  }

  launcherName?: string

  launcherBrand?: string

  maxMemory?: number

  minMemory?: number
  /**
   * Skip the issue checker
   */
  force?: boolean

  ignoreUserStatus?: boolean
}

export interface LaunchService extends StatefulService<LaunchState>, GenericEventEmitter<LaunchServiceEventMap> {
  /**
   * Generate useable launch arguments for current profile
   */
  generateArguments(): Promise<string[]>
  /**
   * Launch the current selected instance. This will return a boolean promise indicate whether launch is success.
   * @returns Does this launch request success?
   */
  launch(options?: LaunchOptions): Promise<boolean>
}

export type LaunchExceptions = {
  type: 'launchNoVersionInstalled'
  /**
   * The override version in options
   */
  override?: string
  /**
   * The version in instance
   */
  version?: string
  minecraft: string
  forge?: string
  fabric?: string
} | {
  /**
   * Unknown error
   */
  type: 'launchGeneralException'
  error: unknown
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
  /**
   * Refresh user status failed
   */
  type: 'launchUserStatusRefreshFailed'
  userException: UserExceptions
}

export class LaunchException extends Exception<LaunchExceptions> { }

export const LaunchServiceKey: ServiceKey<LaunchService> = 'LaunchService'
