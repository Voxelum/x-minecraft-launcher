import { ServiceKey, ServiceTemplate, StatefulService } from './Service'


export interface InstanceShaderPacksService {
  /**
   * It will start to watch `shaderpacks` directory and `optionsshaders.txt` under the instance path
   * @param instancePath The instance absolute path
   */
  link(instancePath: string): Promise<void>

  showDirectory(): Promise<void>
}

export const InstanceShaderPacksServiceKey: ServiceKey<InstanceShaderPacksService> = 'InstanceShaderPacksService'
export const InstanceShaderPacksServiceTemplate: ServiceTemplate<InstanceShaderPacksService> = {
  link: undefined,
  showDirectory: undefined
}
