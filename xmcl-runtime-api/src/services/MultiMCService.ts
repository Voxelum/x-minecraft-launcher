import { CreateInstanceOption } from './InstanceService'
import { ServiceKey } from './Service'
export interface MultiMCService {
  importMultiMCAssets(path: string): Promise<void>
  parseMultiMCInstance(instancePath: string): Promise<CreateInstanceOption & { importPath: string }>
}

export const MultiMCServiceKey: ServiceKey<MultiMCService> = 'MultiMCService'
