import { Resource } from '../entities/resource.schema'
import { ServiceKey } from './Service'
export interface DeployOptions {
  resources: Resource[]
  /**
   * The instance path to deploy. This will be the current path by default.
   */
  path?: string
}
/**
 * Provide the abilities to import mods and resource packs files to instance
 */
export interface InstanceResourceService {
  /**
   * Read all mods under the current instance
   */
  mountModResources(): Promise<void>
  mountResourcepacks(): Promise<void>
  deploy(options: DeployOptions): Promise<void>
  ensureResourcePacksDeployment(): Promise<void>
  undeploy(resources: Resource[]): Promise<void>
}

export const InstanceResourceServiceKey: ServiceKey<InstanceResourceService> = 'InstanceResourceService'
