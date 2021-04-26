import { Resource } from '../entities/resource.schema'
import { StatefulService, ServiceKey, State } from './Service'
import { AnyResource } from '/@shared/entities/resource'
export interface InstallResourcePacksOptions {
  resources: Resource[]
  /**
   * The instance path to deploy. This will be the current path by default.
   */
  path?: string
}

export interface InstanceResourcePacksState extends State { }

export class InstanceResourcePacksState {
  /**
   * The instance resourcepacks
   */
  resourcepacks = [] as AnyResource[]
  /**
   * Mounted instance path
   */
  instance = ''

  instanceResourcepackAdd(r: AnyResource[]) {
    this.resourcepacks.push(...r)
  }

  instanceResourcepackRemove(packs: AnyResource[]) {
    const toRemoved = new Set(packs.map(p => p.hash))
    this.resourcepacks = this.resourcepacks.filter(p => !toRemoved.has(p.hash))
  }

  instanceResourcepacks(payload: { instance: string; resources: AnyResource[] }) {
    this.instance = payload.instance
    this.resourcepacks = payload.resources
  }
}

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
export interface InstanceResourcePacksService extends StatefulService<InstanceResourcePacksState> {
  refresh(force?: boolean): Promise<void>
  mount(instancePath: string): Promise<void>
  ensureResourcePacksDeployment(): Promise<void>
  install(options: InstallResourcePacksOptions): Promise<void>
  uninstall(options: InstallResourcePacksOptions): Promise<void>
}

export const InstanceResourcePacksServiceKey: ServiceKey<InstanceResourcePacksService> = 'InstanceResourcePacksService'
