import { ServiceKey } from './Service'

/**
 * Provide instance spliting service. It can split the game into multiple environment and dynamiclly deploy the resource to run.
 */
export interface InstanceServerInfoService {
  refresh(): Promise<void>
  loadInstanceServerData(path: string): Promise<void>
}

export const InstanceServerInfoServiceKey: ServiceKey<InstanceServerInfoService> = 'InstanceServerInfoService'
