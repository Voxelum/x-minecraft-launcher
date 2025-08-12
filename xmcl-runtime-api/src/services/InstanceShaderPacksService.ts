import { InstanceResourcesService } from './InstanceResourcesService'
import { ServiceKey } from './Service'

export interface InstanceShaderPacksService extends InstanceResourcesService {
}

export const InstanceShaderPacksServiceKey: ServiceKey<InstanceShaderPacksService> = 'InstanceShaderPacksService'
