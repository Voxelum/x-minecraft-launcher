import { Exception } from '../entities/exception'
import { Issue } from '../entities/issue'
import { LaunchStatus } from '../entities/launch'
import { GenericEventEmitter } from '../events'
import { ServiceKey, StatefulService } from './Service'

export class LaunchState {
  status = 'idle' as LaunchStatus
  activeCount = 0
  errorType = ''
  errors = [] as any[]

  launchCount(count: number) {
    this.activeCount = count
  }

  launchStatus(status: LaunchStatus) {
    this.status = status
  }

  launchErrors(error: { type: string; content: any[] }) {
    this.errorType = error.type
    this.errors = error.content
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

  maxMemory?: number

  minMemory?: number
}

export interface LaunchService extends StatefulService<LaunchState>, GenericEventEmitter<LaunchServiceEventMap> {
  /**
   * Generate useable launch arguments for current profile
   */
  generateArguments(): Promise<string[]>
  /**
   * Launch the current selected instance. This will return a boolean promise indicate whether launch is success.
   * @param options
   * @returns Does this launch request success?
   */
  launch(options?: LaunchOptions): Promise<boolean>
}

export type LaunchExceptions = {
  type: 'launchInstanceEmpty' | 'launchIllegalAuth' | 'launchNoVersionInstalled'
} | {
  type: 'launchGeneralException'
  error: unknown
} | {
  type: 'launchBlockedIssues'
  issues: Issue[]
} | {
  type: 'launchNoProperJava'
}

export class LaunchException extends Exception<LaunchExceptions> { }

export const LaunchServiceKey: ServiceKey<LaunchService> = 'LaunchService'
