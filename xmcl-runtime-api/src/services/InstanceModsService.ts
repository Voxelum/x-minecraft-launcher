import { MutableState } from '../util/MutableState'
import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'

export interface InstallModsOptions {
  mods: Resource[]
  /**
   * The instance path to deploy. This will be the current path by default.
   */
  path: string
}

export function getInstanceModStateKey(path: string) {
  return `instance-mods://${path}`
}

export class InstanceModsState {
  /**
   * The mods under instance folder
   */
  mods = [] as Resource[]

  instanceModUpdates({ toAdd, toRemove, toUpdate }: { toAdd: Resource[]; toRemove: Resource[]; toUpdate: Resource[] }) {
    const toRemoved = new Set(toRemove.map(p => p.hash))
    const newMods = [...this.mods]

    for (const res of toAdd) {
      const existed = newMods.findIndex(m => m.hash === res.hash)
      if (existed !== -1) {
        newMods[existed] = res
        // do not remove if the mod is re-updated
        // usually this is rename case
        if (toRemoved.has(res.hash)) toRemoved.delete(res.hash)
      } else {
        newMods.push(res)
      }
    }

    if (toRemove.length > 0) {
      const filtered = newMods.filter(m => !toRemoved.has(m.hash))
      this.mods = filtered
    } else {
      this.mods = newMods
    }

    if (toUpdate.length > 0) {
      for (const res of toUpdate) {
        const existed = this.mods.findIndex(m => m.hash === res.hash)
        if (existed !== -1) {
          this.mods[existed] = { ...res, path: this.mods[existed].path }
        }
      }
    }
  }
}

/**
 * Provide the abilities to import/export mods files to instance
 */
export interface InstanceModsService {
  /**
   * Read all mods under the current instance
   */
  watch(instancePath: string): Promise<MutableState<InstanceModsState>>
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
}

export const InstanceModsServiceKey: ServiceKey<InstanceModsService> = 'InstanceModsService'
