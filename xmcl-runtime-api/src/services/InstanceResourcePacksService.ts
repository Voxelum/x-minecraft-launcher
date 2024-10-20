import { InstallMarketOptionWithInstance } from '../entities/market'
import { Resource, ResourceState } from '../entities/resource'
import { MutableState } from '../util/MutableState'
import { ServiceKey } from './Service'

/**
 * Provide the abilities to diagnose & link resource packs files to instance
 */
export interface InstanceResourcePacksService {
  /**
   * Link the `resourcepacks` directory under the instance path to the root `resourcepacks` directory.
   * @param instancePath The instance path to link.
   * @returns `true` if the link is successful. `false` if the link is failed and it's directory.
   */
  link(instancePath: string, force?: boolean): Promise<boolean>
  /**
   * Unlink the `resourcepacks` directory under the instance path.
   * @param instancePath The instance path to unlink.
   */
  unlink(instancePath: string): Promise<void>
  /**
   * Check if the `resourcepacks` directory under the instance path is linked.
   * @param instancePath The instance path
   */
  isLinked(instancePath: string): Promise<boolean>
  /**
   * Watch the `resourcepacks` directory under the instance path and import the resource packs.
   * @param instancePath The instance path
   */
  watch(instancePath: string): Promise<MutableState<ResourceState>>
  /**
   * Manually install the resource packs to the instance.
   *
   * Only call this if you don't want to use link or link is failed.
   *
   * @param instancePath The instance path
   * @param resourcePackFile The absolute path of the resource pack file
   */
  install(instancePath: string, resourcePackFile: string | string[]): Promise<string[]>
  /**
   * Uninstall the resourcepack file from the instance.
   */
  uninstall(instancePath: string, resourcePackFile: string | string[]): Promise<void>
  /**
   * Install resource packs from the market to the instance.
   */
  installFromMarket(options: InstallMarketOptionWithInstance): Promise<string[]>
  /**
   * Show the `resourcepacks` directory under the instance path
   * @param instancePath The instance path
   */
  showDirectory(instancePath: string): Promise<void>
}

export const InstanceResourcePacksServiceKey: ServiceKey<InstanceResourcePacksService> = 'InstanceResourcePacksService'
