import { MutableState } from '../util/MutableState'
import { Resource } from '../entities/resource'
import { ServiceKey } from './Service'
import { PartialResourceHash } from './ResourceService'

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

export const enum InstanceModUpdatePayloadAction { Upsert = 0, Remove = 1, Update = 2 }

export type InstanceModUpdatePayload = [Resource, InstanceModUpdatePayloadAction.Remove | InstanceModUpdatePayloadAction.Upsert] | [PartialResourceHash[], InstanceModUpdatePayloadAction.Update]

export function applyUpdateToResource(resource: Resource, update: PartialResourceHash) {
  resource.name = update.name ?? resource.name
  for (const [key, val] of Object.entries(update.metadata ?? {})) {
    if (!val) continue
    (resource.metadata as any)[key] = val as any
  }
  resource.tags = update.tags ?? resource.tags
  resource.icons = update.icons ?? resource.icons
  resource.uris = update.uris ?? resource.uris
}

export class InstanceModsState {
  /**
   * The mods under instance folder
   */
  mods = [] as Resource[]

  instanceModUpdates(ops: InstanceModUpdatePayload[]) {
    const mods = [...this.mods]
    for (const [r, a] of ops) {
      if (a === InstanceModUpdatePayloadAction.Upsert) {
        const index = mods.findIndex(m => m?.path === r?.path || m.hash === r.hash)
        if (index === -1) {
          mods.push(r)
        } else {
          const existed = mods[index]
          if (existed.path !== r.path) {
            mods[index] = r
          } else if (process.env.NODE_ENV === 'development') {
            // eslint-disable-next-line no-debugger
            console.debug(`The mod ${r.path} is already in the list!`)
          }
        }
      } else if (a === InstanceModUpdatePayloadAction.Remove) {
        const index = mods.findIndex(m => m?.path === r?.path || m.hash === r.hash)
        if (index !== -1) mods.splice(index, 1)
      } else {
        for (const update of r as PartialResourceHash[]) {
          for (const m of mods) {
            if (m.hash === update.hash) {
              applyUpdateToResource(m, update)
            }
          }
        }
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
   * Install mods to the server instance.
   */
  installToServerInstance(options: InstallModsOptions): Promise<void>

  getServerInstanceMods(path: string): Promise<Array<{ fileName: string; ino: number }>>
}

export const InstanceModsServiceKey: ServiceKey<InstanceModsService> = 'InstanceModsService'
