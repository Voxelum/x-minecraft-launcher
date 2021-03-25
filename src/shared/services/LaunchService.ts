import { ServiceKey } from './Service'

export interface LaunchService {
  generateArguments(): Promise<string[]>
  /**
   * Launch the current selected instance. This will return a boolean promise indeicate whether launch is success.
   * @param force
   * @returns Does this launch request success?
   */
  launch(force?: boolean): Promise<boolean>
}

export const LaunchServiceKey: ServiceKey<LaunchService> = 'LaunchService'
