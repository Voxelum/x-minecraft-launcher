import type { Resource } from '@xmcl/resource'
import { InstanceResourcesService, UpdateInstanceResourcesOptions } from './InstanceResourcesService'
import { ServiceKey } from './Service'

export function getInstanceModStateKey(path: string) {
  return `instance-mods://${path}`
}

/**
 * Provide the abilities to import/export mods files to instance
 */
export interface InstanceModsService extends InstanceResourcesService {
  /**
   * Refresh the metadata of the instance mods
   */
  refreshMetadata(instancePath: string): Promise<void>
  /**
   * Mark mods enabled
   */
  enable(options: UpdateInstanceResourcesOptions): Promise<void>
  /**
   * Mark mods disabled
   */
  disable(options: UpdateInstanceResourcesOptions): Promise<void>
  /**
   * Install mods to the server instance.
   */
  installToServerInstance(options: UpdateInstanceResourcesOptions): Promise<void>

  getServerInstanceMods(path: string): Promise<Array<{ fileName: string; ino: number }>>
  /**
   * Search the installed mods cache.
   */
  searchInstalled(keyword: string): Promise<Resource[]>
}

export const InstanceModsServiceKey: ServiceKey<InstanceModsService> = 'InstanceModsService'
