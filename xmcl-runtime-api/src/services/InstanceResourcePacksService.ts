import { InstanceResourcesService } from './InstanceResourcesService'
import { ServiceKey } from './Service'

/**
 * Provide the abilities to diagnose & link resource packs files to instance
 */
export interface InstanceResourcePacksService extends InstanceResourcesService {
}

export const InstanceResourcePacksServiceKey: ServiceKey<InstanceResourcePacksService> = 'InstanceResourcePacksService'
