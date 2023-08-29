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

const enum Action { Add = 0, Remove = 1, Replace = 2 }
export class InstanceModsState {
  /**
   * The mods under instance folder
   */
  mods = [] as Resource[]

  instanceModUpdates(ops: [Resource, Action][]) {
    const mods = [...this.mods]
    for (const [r, a] of ops) {
      if (a === Action.Add) {
        const index = mods.findIndex(m => m.path === r.path)
        if (index === -1) {
          mods.push(r)
        } else if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-debugger
          console.debug(`The mod ${r.path} is already in the list!`)
        }
      } else if (a === Action.Remove) {
        const index = mods.findIndex(m => m.path === r.path)
        if (index !== -1) mods.splice(index, 1)
      } else {
        const index = mods.findIndex(m => m.path === r.path)
        if (index !== -1) mods[index] = { ...r, path: mods[index].path }
      }
    }
    this.mods = mods
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
