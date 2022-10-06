import { ServiceKey } from './Service'

export interface UpdateInstanceOptions {
  /**
   * The instance to update
   */
  instancePath: string

}

export interface InstanceUpdateService {
  updateInstance(options: UpdateInstanceOptions): Promise<void>

  downgradeInstance(): Promise<void>
}

export const InstanceUpdateServiceKey: ServiceKey<InstanceUpdateService> = 'InstanceUpdateService'
