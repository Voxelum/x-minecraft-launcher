import { InstallMarketOptionWithInstance } from '../entities/market'
import { Resource, ResourceState } from '../entities/resource'
import { SharedState } from '../util/SharedState'
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
  watch(instancePath: string): Promise<SharedState<ResourceState>>
  /**
   * Manually install the shaderpack to the instance.
   *
   * Please don't call this method if the directory is linked.
   *
   * @param instancePath The instance absolute path
   * @param shaderPackFilePath The shaderpack file path. This file must existed in the central `shaderpacks` directory.
   */
  install(instancePath: string, shaderPackFilePath: string | string[]): Promise<string[]>
  /**
   * Uninstall the shaderpack file from the instance.
   */
  uninstall(instancePath: string, file: string | string[]): Promise<void>
  /**
   * Install shader packs from the market to the instance.
   */
  installFromMarket(options: InstallMarketOptionWithInstance): Promise<string[]>
  /**
   * Show shaderPacks folder under the instance path
   * @param instancePath The instance absolute path
   */
  showDirectory(instancePath: string): Promise<void>
}

export const InstanceShaderPacksServiceKey: ServiceKey<InstanceShaderPacksService> = 'InstanceShaderPacksService'
