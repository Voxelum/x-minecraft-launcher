import { InstanceDataWithTime, applyInstanceChanges, type CreateInstanceOptions, type EditInstanceOptions, type Instance } from '@xmcl/instance'
import type { InstanceModpackMetadataSchema } from '../entities/instance.schema'
import type { Task } from '../task'
import type { SharedState } from '../util/SharedState'
import type { InvalidDirectoryErrorCode } from './BaseService'
import type { ServiceKey } from './Service'

export interface DuplicateInstanceTask extends Task {
  type: 'duplicateInstance'
  from: string
  to: string
}

export type CreateInstanceOption = CreateInstanceOptions

export /* @__PURE__ */ class /* @__PURE__ */ InstanceState {
  /**
   * All loaded launch instances
   */
  all = {} as { [path: string]: Instance }
  /**
   * All selected instances.
   */
  instances: Instance[] = []

  instanceAdd(instance: Instance) {
    if (!this.all[instance.path]) {
      // TODO: remove in vue3
      // set(this.all, instance.path, { ...instance, serverStatus: UNKNOWN_STATUS })
      const object = {
        ...instance,
      }
      this.all[instance.path] = object
      this.instances.push(this.all[instance.path])
    }
  }

  instanceRemove(path: string) {
    delete this.all[path]
    this.instances = this.instances.filter((i) => i.path !== path)
  }

  instanceMove({ from, to }: { from: string; to: string }) {
    const inst = this.instances.find((i) => i.path === from)
    if (inst) {
      inst.path = to
      delete this.all[from]
      this.all[to] = inst
    }
  }

  /**
   * Edit the profile content. This commit will trigger save function to store the data to the disk.
   * Don't use this directly. Use `editProfile` action
   * @param settings The modified data
   */
  instanceEdit(settings: Partial<InstanceDataWithTime> & { path: string }) {
    const inst = this.instances.find(
      (i) => i.path === settings.path,
    )

    if (!inst) {
      return
    }

    applyInstanceChanges(inst, settings)
  }
}

/**
 * Provide instance splitting service. It can split the game into multiple environment and dynamically deploy the resource to run.
 */
export interface InstanceService {
  getSharedInstancesState(): Promise<SharedState<InstanceState>>
  /**
   * Create a managed instance (either a modpack or a server) under the managed folder.
   * @param option The creation option
   * @returns The instance path
   */
  createInstance(option: CreateInstanceOption): Promise<string>
  /**
   * Delete the managed instance from the disk
   * @param path The instance path
   */
  deleteInstance(path?: string, deleteData?: boolean): Promise<void>
  /**
   * Duplicate the instance.
   */
  duplicateInstance(path: string): Promise<string>
  /**
   * Edit the instance. If the `path` is not present, it will edit the current selected instance.
   * Otherwise, it will edit the instance on the provided path.
   */
  editInstance(options: EditInstanceOptions & { instancePath: string }): Promise<void>
  /**
   * Get or create a MANAGED instance via your unique id
   * @param id The unique id, can be any string, but it will convert to a string can be file name
   * @returns The instance path
   */
  acquireInstanceById(id: string): Promise<string>

  validateInstancePath(path: string): Promise<InvalidDirectoryErrorCode>

  getInstanceModpackMetadata(path: string): Promise<InstanceModpackMetadataSchema | undefined>

  setInstanceModpackMetadata(
    path: string,
    metadata: InstanceModpackMetadataSchema | undefined,
  ): Promise<void>
}

export const InstanceServiceKey: ServiceKey<InstanceService> = 'InstanceService'
