import { Resource } from '../entities/resource.schema'
import { StatefulService, ServiceKey } from './Service'
import { AnyResource } from '../entities/resource'
import { IssueKey } from '../entities/issue'
export interface InstallModsOptions {
  mods: Resource[]
  /**
   * The instance path to deploy. This will be the current path by default.
   */
  path?: string
}

/**
 * The service manage all enable mods in mounted instance
 */
export class InstanceModsState {
  /**
   * The mods under instance folder
   */
  mods = [] as AnyResource[]
  /**
   * The mounted instance
   */
  instance = ''

  instanceModUpdate(r: AnyResource[]) {
    for (const res of r) {
      const existed = this.mods.findIndex(m => m.hash === res.hash)
      if (existed !== -1) {
        this.mods[existed] = res
      } else {
        this.mods.push(res)
      }
    }
  }

  instanceModUpdateExisted(r: AnyResource[]) {
    for (const res of r) {
      const existed = this.mods.findIndex(m => m.hash === res.hash)
      if (existed !== -1) {
        this.mods[existed] = { ...res, path: this.mods[existed].path }
      }
    }
  }

  instanceModRemove(mods: AnyResource[]) {
    const toRemoved = new Set(mods.map(p => p.hash))
    this.mods = this.mods.filter(m => !toRemoved.has(m.hash))
  }

  instanceMods(payload: { instance: string; resources: AnyResource[] }) {
    this.instance = payload.instance
    this.mods = payload.resources
  }
}

export const RequireFabricAPIIssueKey: IssueKey<{ version: string; name: string }> = 'requireFabricAPI'
export const RequireForgeIssueKey: IssueKey<{}> = 'requireForge'
export const RequireFabricIssueKey: IssueKey<{}> = 'requireFabric'

/**
 * Provide the abilities to import/export mods files to instance
 */
export interface InstanceModsService extends StatefulService<InstanceModsState> {
  /**
   * Read all mods under the current instance
   */
  mount(instancePath: string): Promise<void>
  /**
   * Refresh current mounted instance mods. It will reload the mods in state.
   */
  refresh(force?: boolean): Promise<void>

  showDirectory(): Promise<void>
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
}

export const InstanceModsServiceKey: ServiceKey<InstanceModsService> = 'InstanceModsService'
