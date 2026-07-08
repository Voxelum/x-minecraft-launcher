import { InstanceResourcesService } from './InstanceResourcesService'
import { ServiceKey } from './Service'

export interface InstanceShaderPacksService extends InstanceResourcesService {
  /**
   * Whether the instance's `shaderpacks` folder is linked to the global shared folder.
   */
  isLinked(instancePath: string): Promise<boolean>
  /**
   * Link the instance's `shaderpacks` folder to the global shared folder.
   *
   * Existing packs are merged into the shared folder first.
   */
  linkShared(instancePath: string): Promise<void>
  /**
   * Unlink the instance's `shaderpacks` folder from the global shared folder.
   */
  unlinkShared(instancePath: string): Promise<void>
}

export const InstanceShaderPacksServiceKey: ServiceKey<InstanceShaderPacksService> = 'InstanceShaderPacksService'
