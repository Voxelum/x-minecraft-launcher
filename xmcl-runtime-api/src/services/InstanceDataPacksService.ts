import { InstanceResourcesService } from './InstanceResourcesService'
import { ServiceKey } from './Service'

/**
 * Provide the abilities to diagnose & link data packs files to instance
 */
export interface InstanceDataPacksService extends InstanceResourcesService {
}

export const InstanceDataPacksServiceKey: ServiceKey<InstanceDataPacksService> = 'InstanceDataPacksService'
