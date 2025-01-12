import { InstallMarketOptionWithInstance } from '../entities/market'
import { ResourceState, Resource } from '../entities/resource'
import { SharedState } from '../util/SharedState'
import { ServiceKey } from './Service'

export interface InstallModsOptions {
  mods: string[]
  /**
   * The instance path to deploy. This will be the current path by default.
   */
  path: string
}

export function getInstanceModStateKey(path: string) {
  return `instance-mods://${path}`
}

/**
 * Provide the abilities to import/export mods files to instance
 */
export interface InstanceModsService {
  /**
   * Read all mods under the current instance
   */
  watch(instancePath: string): Promise<SharedState<ResourceState>>
  /**
   * Refresh the metadata of the instance mods
   */
  refreshMetadata(instancePath: string): Promise<void>
  /**
   * Show instance /mods dictionary
   * @param instancePath The instance path
   */
  showDirectory(instancePath: string): Promise<void>
  /**
   * Mark mods enabled
   */
  enable(options: InstallModsOptions): Promise<void>
  /**
   * Mark mods disabled
   */
  disable(options: InstallModsOptions): Promise<void>
  /**
   * Install certain mods to the instance.
   * @param options The install options
   */
  install(options: InstallModsOptions): Promise<void>
  /**
   * Uninstall certain mods to the instance.
   * @param options The uninstall options
   */
  uninstall(options: InstallModsOptions): Promise<void>
  /**
   * Install mods from the market to the instance.
   */
  installFromMarket(options: InstallMarketOptionWithInstance): Promise<string[]>
  /**
   * Install mods to the server instance.
   */
  installToServerInstance(options: InstallModsOptions): Promise<void>

  getServerInstanceMods(path: string): Promise<Array<{ fileName: string; ino: number }>>
  /**
   * Search the installed mods cache.
   */
  searchInstalled(keyword: string): Promise<Resource[]>
}

export const InstanceModsServiceKey: ServiceKey<InstanceModsService> = 'InstanceModsService'
