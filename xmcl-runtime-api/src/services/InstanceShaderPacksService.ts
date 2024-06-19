import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'

export interface InstanceShaderPacksService {
  /**
   * Try to link the `shaderpacks` directory to the central `shaderpacks` directory.
   * @param instancePath The instance absolute path
   */
  link(instancePath: string, force?: boolean): Promise<boolean>
  /**
   * Unlink the `shaderpacks` directory under the instance path.
   * @param instancePath The instance path to unlink.
   */
  unlink(instancePath: string): Promise<void>
  /**
   * Check if the `shaderpacks` directory under the instance path is linked.
   * @param instancePath The instance path
   */
  isLinked(instancePath: string): Promise<boolean>
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
   */
  install(instancePath: string, shaderPackFilePath: string): Promise<void>
  /**
   * Show shaderPacks folder under the instance path
   * @param instancePath The instance absolute path
   */
  showDirectory(instancePath: string): Promise<void>
}

export const InstanceShaderPacksServiceKey: ServiceKey<InstanceShaderPacksService> = 'InstanceShaderPacksService'
