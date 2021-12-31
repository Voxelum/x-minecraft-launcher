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

export interface LaunchService extends StatefulService<LaunchState>, GenericEventEmitter<LaunchServiceEventMap> {
  /**
   * Generate useable launch arugments for current profile
   */
  generateArguments(): Promise<string[]>
  /**
   * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
   * @param force
   * @returns Does this launch request success?
   */
  launch(force?: boolean): Promise<boolean>
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
