import { ServiceKey, StatefulService } from './Service'
import { LaunchStatus } from '/@shared/entities/launch'

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

export interface LaunchService extends StatefulService<LaunchState> {
  generateArguments(): Promise<string[]>
  /**
   * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
   * @param force
   * @returns Does this launch request success?
   */
  launch(force?: boolean): Promise<boolean>
}

export const LaunchServiceKey: ServiceKey<LaunchService> = 'LaunchService'
