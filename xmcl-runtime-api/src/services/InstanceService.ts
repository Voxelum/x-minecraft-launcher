import { MutableState } from '../util/MutableState'
import { Exception } from '../entities/exception'
import { Instance } from '../entities/instance'
import { InstanceSchema } from '../entities/instance.schema'
import { DeepPartial } from '../util/object'
import { ServiceKey } from './Service'

export type CreateInstanceOption = Partial<Omit<InstanceSchema, 'lastAccessDate' | 'creationDate'>> & {
  path?: string
  name: string
  resolution?: InstanceSchema['resolution']
  runtime?: InstanceSchema['runtime']
  server?: InstanceSchema['server']
}
export interface EditInstanceOptions extends Partial<Omit<InstanceSchema, 'runtime' | 'server'>> {
  resolution?: InstanceSchema['resolution']
  runtime?: InstanceSchema['runtime']
  /**
   * If this is undefined, it will disable the server of this instance
   */
  server?: InstanceSchema['server']
}

export class InstanceState {
  /**
   * All loaded launch instances
   */
  all = {} as { [path: string]: Instance }
  /**
   * All selected instances.
   */
  instances: Instance[] = []

  instanceAdd(instance: Instance) {
    /**
     * Prevent the case that hot reload keep the vuex state
     */
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
    this.instances = this.instances.filter(i => i.path !== path)
  }

  instanceMove({ from, to }: { from: string; to: string }) {
    const inst = this.instances.find(i => i.path === from)
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
  instanceEdit(settings: DeepPartial<InstanceSchema> & { path: string }) {
    const inst = this.instances.find(i => i.path === (settings.path)) /* this.all[settings.path || this.path] */

    if (!inst) {
      return
    }

    inst.name = typeof settings.name === 'string' ? settings.name : inst.name

    inst.author = settings.author || inst.author
    inst.description = settings.description || inst.description
    inst.version = typeof settings.version === 'string' ? settings.version : inst.version

    if (settings.server) {
      if (inst.server) {
        inst.server.host = settings.server.host || inst.server.host
        inst.server.port = settings.server.port || inst.server.port
      } else {
        inst.server = {
          host: settings.server.host,
          port: settings.server.port,
        }
      }
    }

    if (settings.runtime) {
      const versions = settings.runtime
      if (inst.runtime.minecraft !== settings.runtime.minecraft && typeof versions.minecraft === 'string') {
        // if minecraft version changed, all other related versions are rest.
        inst.runtime.minecraft = versions.minecraft
        inst.runtime.forge = ''
        inst.runtime.neoForged = ''
        inst.runtime.liteloader = ''
        inst.runtime.optifine = ''
      }

      for (const versionType of Object.keys(versions).filter(v => v !== 'minecraft')) {
        const ver = versions[versionType]
        if (typeof ver === 'string') {
          inst.runtime[versionType] = ver
        }
      }
    }

    if ('minMemory' in settings) {
      inst.minMemory = (typeof settings.minMemory === 'number') && settings.minMemory > 0 ? settings.minMemory : undefined
    }
    if ('maxMemory' in settings) {
      inst.maxMemory = (typeof settings.maxMemory === 'number') && settings.maxMemory > 0 ? settings.maxMemory : undefined
    }
    if ('prependCommand' in settings) {
      inst.prependCommand = settings.prependCommand
    }

    if ('vmOptions' in settings) {
      inst.vmOptions = Object.seal(settings.vmOptions)
    }
    if ('mcOptions' in settings) {
      inst.mcOptions = Object.seal(settings.mcOptions)
    }
    if ('java' in settings) {
      inst.java = settings.java
    }

    inst.url = settings.url ?? inst.url
    inst.icon = settings.icon ?? inst.icon
    inst.modpackVersion = settings.modpackVersion ?? inst.modpackVersion
    inst.fileApi = settings.fileApi ?? inst.fileApi
    inst.upstream = settings.upstream ?? inst.upstream
    inst.playtime = settings.playtime ?? inst.playtime
    inst.lastPlayedDate = settings.lastPlayedDate ?? inst.lastPlayedDate
    inst.lastAccessDate = settings.lastAccessDate ?? inst.lastAccessDate
    inst.icon = settings.icon ?? inst.icon

    if ('showLog' in settings) {
      inst.showLog = settings.showLog
    }
    if ('hideLauncher' in settings) {
      inst.hideLauncher = settings.hideLauncher
    }
    if ('fastLaunch' in settings) {
      inst.fastLaunch = settings.fastLaunch
    }
    if ('assignMemory' in settings && settings.assignMemory !== inst.assignMemory) {
      inst.assignMemory = settings.assignMemory
    }
    if ('disableAuthlibInjector' in settings) {
      inst.disableAuthlibInjector = settings.disableAuthlibInjector
    }
    if ('disableElybyAuthlib' in settings) {
      inst.disableElybyAuthlib = settings.disableElybyAuthlib
    }
  }
}

/**
 * Provide instance splitting service. It can split the game into multiple environment and dynamically deploy the resource to run.
 */
export interface InstanceService {
  getSharedInstancesState(): Promise<MutableState<InstanceState>>
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
  deleteInstance(path?: string): Promise<void>
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
   * Add a directory as managed instance folder. It will try to load the instance.json.
   * If it's a common folder, it will try to create instance from the directory data.
   * @param path The path of the instance
   */
  addExternalInstance(path: string): Promise<boolean>
  /**
   * Get or create a MANAGED instance via your unique id
   * @param id The unique id, can be any string, but it will convert to a string can be file name
   * @returns The instance path
   */
  acquireInstanceById(id: string): Promise<string>

  validateInstancePath(path: string): Promise<'bad' | 'nondictionary' | 'noperm' | 'exists' | undefined>
}

export const InstanceServiceKey: ServiceKey<InstanceService> = 'InstanceService'

export type InstanceExceptions = {
  type: 'instanceNameDuplicated'
  path: string
  name: string
} | {
  type: 'instanceNameRequired'
} | {
  type: 'instanceNotFound'
  path: string
} | {
  type: 'instancePathInvalid'
  path: string
  reason: string
}

export class InstanceException extends Exception<InstanceExceptions> {
}
