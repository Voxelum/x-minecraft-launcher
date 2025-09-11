import type { ResourceState } from '@xmcl/resource'
import { InstallMarketOptionWithInstance } from '../entities/market'
import { SharedState } from '../util/SharedState'

export interface UpdateInstanceResourcesOptions {
  /**
   * The resource files
   */
  files: string[]
  /**
   * The instance path to deploy. This will be the current path by default.
   */
  path: string
}
/**
 * Provide the abilities to install resources files to instance
 */
export interface InstanceResourcesService {
  /**
   * Watch the `resourcepacks` directory under the instance path and import the resources file.
   * @param instancePath The instance path
   */
  watch(instancePath: string): Promise<SharedState<ResourceState>>
  /**
   * Manually install the resources to the instance.
   *
   * Only call this if you don't want to use link or link is failed.
   */
  install(options: UpdateInstanceResourcesOptions): Promise<string[]>
  /**
   * Uninstall the resourcepack file from the instance.
   */
  uninstall(options: UpdateInstanceResourcesOptions): Promise<void>
  /**
   * Install resources from the market to the instance.
   */
  installFromMarket(options: InstallMarketOptionWithInstance): Promise<string[]>
  /**
   * Show the `resourcepacks` directory under the instance path
   * @param instancePath The instance path
   */
  showDirectory(instancePath: string): Promise<void>
}

