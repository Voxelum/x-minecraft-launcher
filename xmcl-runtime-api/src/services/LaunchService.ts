import { GenericEventEmitter } from '../events'
import { LaunchStatus } from '../entities/launch'
import { ServiceKey, ServiceTemplate, StatefulService } from './Service'

export class LaunchState {
  status = 'ready' as LaunchStatus
  errorType = ''
  errors = [] as any[]

  launchStatus(status: LaunchStatus) {
    this.status = status
  }

  launchErrors(error: { type: string; content: any[] }) {
    this.errorType = error.type
    this.errors = error.content
  }
}

interface LaunchServiceEventMap {
  'minecraft-window-ready': void
  'minecraft-start': void
  'minecraft-exit': { code?: number; signal?: string; crashReport?: string; crashReportLocation?: string; errorLog: string }
  'minecraft-stdout': string
  'minecraft-stderr': string
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

export const LaunchServiceKey: ServiceKey<LaunchService> = 'LaunchService'
export const LaunchServiceMethods: ServiceTemplate<LaunchService> = {
  generateArguments: undefined,
  launch: undefined,
  state: undefined,
  on: undefined,
  once: undefined,
  removeListener: undefined,
}
