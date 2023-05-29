import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'

export interface InstanceShaderPacksService {
  /**
   * Try to link the `shaderpacks` directory to the central `shaderpacks` directory.
   * @param instancePath The instance absolute path
   */
  link(instancePath: string): Promise<boolean>
  /**
   * This will scan the `shaderpacks` directory and import all shaderpacks into the resource service.
   * @param instancePath The instance absolute path
   */
  scan(instancePath: string): Promise<Resource[]>
  /**
   * Manually install the shaderpack to the instance.
   *
   * Please don't call this method if the directory is linked.
   *
   * @param instancePath The instance absolute path
   * @param shaderPackFilePath The shaderpack file path. This file must existed in the central `shaderpacks` directory.
   *
   * @returns `true` mean this is installed by link. `false` mean this is installed by copy.
   */
  install(instancePath: string, shaderPackFilePath: string): Promise<boolean>
  /**
   * Show shaderPacks folder under the instance path
   * @param instancePath The instance absolute path
   */
  showDirectory(instancePath: string): Promise<void>
}

export const InstanceShaderPacksServiceKey: ServiceKey<InstanceShaderPacksService> = 'InstanceShaderPacksService'
