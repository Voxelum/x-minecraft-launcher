import { CreateInstanceOption, createTemplate, EditInstanceOptions, Instance, InstanceSchema, InstanceService as IInstanceService, InstanceServiceKey, InstancesSchema, InstanceState, LATEST_RELEASE, RuntimeVersions } from '@xmcl/runtime-api'
import { ensureDir, remove } from 'fs-extra'
import { join, resolve } from 'path'
import { v4 } from 'uuid'
import LauncherApp from '../app/LauncherApp'
import { exists, isDirectory, missing, readdirEnsured } from '../util/fs'
import { assignShallow, requireObject, requireString } from '../util/object'
import { createSafeFile, createSafeIO } from '../util/persistance'
import InstallService from './InstallService'
import ServerStatusService from './ServerStatusService'
import { ExportService, Inject, Singleton, StatefulService } from './Service'
import UserService from './UserService'

const INSTANCES_FOLDER = 'instances'

/**
 * Provide instance spliting service. It can split the game into multiple environment and dynamically deploy the resource to run.
 */
@ExportService(InstanceServiceKey)
export class InstanceService extends StatefulService<InstanceState> implements IInstanceService {
  protected readonly instancesFile = createSafeFile(this.getPath('instances.json'), InstancesSchema, this)
  protected readonly instanceFile = createSafeIO(InstanceSchema, this)

  constructor(app: LauncherApp,
    @Inject(ServerStatusService) protected statusService: ServerStatusService,
    @Inject(UserService) private userService: UserService,
    @Inject(InstallService) private installService: InstallService,
  ) {
    super(app, async () => {
      const uuidExp = /([a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}){1}/

      const { state } = this
      const instanceConfig = await this.instancesFile.read()
      const managed = (await readdirEnsured(this.getPathUnder())).map(p => this.getPathUnder(p)).filter(f => uuidExp.test(f))

      this.log(`Found ${managed.length} managed instances and ${instanceConfig.instances.length} external instances.`)

      const all = [...new Set([...instanceConfig.instances, ...managed])]
      const staleInstances = new Set<string>()

      await Promise.all(all.map(async (path) => {
        if (!await this.loadInstance(path)) {
          staleInstances.add(path)
        }
      }))

      if (staleInstances.size > 0) {
        await this.instancesFile.write({
          selectedInstance: instanceConfig.selectedInstance,
          instances: instanceConfig.instances.filter(p => !staleInstances.has(p)),
        })
      }

      if (Object.keys(state.all).length === 0) {
        this.log('Cannot find any instances, try to init one default modpack.')
        await this.createAndMount({})
      } else {
        if (this.state.all[instanceConfig.selectedInstance]) {
          await this.mountInstance(instanceConfig.selectedInstance)
        } else {
          await this.mountInstance(Object.keys(state.all)[0])
        }
      }

      this.storeManager
        .subscribe('instanceAdd', async (payload: Instance) => {
          await this.instanceFile.write(join(payload.path, 'instance.json'), payload)
          await this.instancesFile.write({ instances: Object.keys(this.state.all), selectedInstance: this.state.path })
          this.log(`Saved new instance ${payload.path}`)
        })
        .subscribe('instanceRemove', async () => {
          await this.instancesFile.write({ instances: Object.keys(this.state.all), selectedInstance: this.state.path })
          this.log(`Removed instance files under ${this.state.instance.path}`)
        })
        .subscribe('instanceEdit', async () => {
          const inst = this.state.all[this.state.instance.path]
          await this.instanceFile.write(join(inst.path, 'instance.json'), inst)
          this.log(`Saved instance ${this.state.instance.path}`)
        })
        .subscribe('instanceSelect', async (path) => {
          await this.instanceFile.write(join(path, 'instance.json'), this.state.all[path])
          await this.instancesFile.write({ instances: Object.keys(this.state.all), selectedInstance: this.state.path })
          this.log(`Saved instance selection ${path}`)
        })
    })
  }

  createState() { return new InstanceState() }

  protected getPathUnder(...ps: string[]) {
    return this.getPath(INSTANCES_FOLDER, ...ps)
  }

  async loadInstance(path: string) {
    requireString(path)

    let option: InstanceSchema

    if (!await isDirectory(path)) {
      return false
    }
    this.log(`Start load instance ${path}`)
    try {
      option = await this.instanceFile.read(join(path, 'instance.json'))
    } catch (e) {
      this.warn(`Cannot load instance json ${path}`)
      this.warn(e)
      return false
    }

    const instance = createTemplate()

    instance.author = instance.author || this.userService.state.gameProfile?.name || ''
    instance.runtime.minecraft = LATEST_RELEASE.id

    assignShallow(instance, option)
    if (option.runtime) {
      assignShallow(instance.runtime, option.runtime)
    }
    if (option.resolution) {
      if (instance.resolution) {
        instance.resolution.width = option.resolution.width
        instance.resolution.height = option.resolution.height
        instance.resolution.fullscreen = option.resolution.fullscreen
      } else {
        instance.resolution = option.resolution
      }
    }

    instance.runtime.minecraft = instance.runtime.minecraft || LATEST_RELEASE.id
    instance.author = instance.author || this.userService.state.gameProfile?.name || ''

    if (option.server) {
      instance.server = option.server
    }

    instance.path = path

    this.state.instanceAdd(instance)

    this.log(`Loaded instance ${instance.path}`)

    return true
  }

  async createInstance(payload: CreateInstanceOption): Promise<string> {
    requireObject(payload)

    const instance = createTemplate()

    assignShallow(instance, payload)
    if (payload.runtime) {
      assignShallow(instance.runtime, payload.runtime)
    }
    if (payload.resolution) {
      if (instance.resolution) {
        assignShallow(instance.resolution, payload.resolution)
      } else {
        instance.resolution = payload.resolution
      }
    }
    if (payload.server) {
      instance.server = payload.server
    }

    instance.path = payload.path || this.getPathUnder(v4())
    instance.runtime.minecraft = instance.runtime.minecraft || this.installService.state.minecraftRelease.id
    instance.author = this.userService.state.gameProfile?.name ?? ''
    instance.creationDate = Date.now()
    instance.lastAccessDate = Date.now()

    instance.author = payload.author ?? instance.author
    instance.description = payload.description ?? instance.description
    instance.showLog = payload.showLog ?? instance.showLog

    await ensureDir(instance.path)
    this.state.instanceAdd(instance)

    this.log('Created instance with option')
    this.log(JSON.stringify(instance, null, 4))

    return instance.path
  }

  /**
   * Create a managed instance in storage.
   */
  async createAndMount(payload: CreateInstanceOption): Promise<string> {
    requireObject(payload)

    const path = await this.createInstance(payload)
    await this.mountInstance(path)
    return path
  }

  /**
   * Mount the instance as the current active instance.
   * @param path the instance path
   */
  @Singleton()
  async mountInstance(path: string) {
    requireString(path)

    if (path === this.state.instance.path) { return }

    const missed = await missing(path)
    if (missed) {
      this.log(`Cannot mount instance ${path}, either the directory not exist or the launcher has no permission.`)
      return
    }

    this.log(`Try to mount instance ${path}`)

    // not await this to improve the performance

    this.state.instanceSelect(path)
  }

  /**
   * Delete the managed instance from the disk
   * @param path The instance path
   */
  async deleteInstance(path = this.state.instance.path) {
    requireString(path)

    // if the instance is selected now
    if (this.state.instance.path === path) {
      const restPath = Object.keys(this.state.all).filter(p => p !== path)
      // if only one instance left
      if (restPath.length === 0) {
        // then create and select a new one
        await this.createAndMount({})
      } else {
        // else select the first instance
        await this.mountInstance(restPath[0])
      }
    }

    this.state.instanceRemove(path)

    const isManaged = resolve(path).startsWith(resolve(this.getPathUnder()))
    if (isManaged && await exists(path)) {
      await remove(path)
    }
  }

  /**
   * Edit the instance. If the `path` is not present, it will edit the current selected instance.
   * Otherwise, it will edit the instance on the provided path
   */
  async editInstance(options: EditInstanceOptions) {
    requireObject(options)

    const instancePath = options.instancePath || this.state.instance.path
    const state = this.state.all[instancePath]

    const ignored = { runtime: true, deployments: true, server: true, vmOptions: true, mcOptions: true, minMemory: true, maxMemory: true }
    const result: Record<string, any> = {}
    for (const key of Object.keys(options)) {
      if (key in ignored) {
        continue
      }
      if (key in state) {
        if ((state as any)[key] !== (options as any)[key]) {
          result[key] = (options as any)[key]
        }
      }
    }

    if ('maxMemory' in options && options.maxMemory !== state.maxMemory) {
      if (typeof options.maxMemory === 'undefined') {
        result.maxMemory = 0
      } else if (typeof options.maxMemory === 'number' && options.maxMemory) {
        result.maxMemory = options.maxMemory > 0 ? options.maxMemory : 0
      } else {
        throw new Error(`Invalid Argument: Expect maxMemory to be number or undefined! Got ${typeof options.maxMemory}.`)
      }
    }
    if ('minMemory' in options && options.minMemory !== state.minMemory) {
      if (typeof options.minMemory === 'undefined') {
        result.minMemory = 0
      } else if (typeof options.minMemory === 'number') {
        result.minMemory = options.minMemory > 0 ? options.minMemory : 0
      } else {
        throw new Error(`Invalid Argument: Expect minMemory to be number or undefined! Got ${typeof options.maxMemory}.`)
      }
    }

    if ('runtime' in options && options.runtime) {
      const runtime = options.runtime
      const currentRuntime = state.runtime
      const resultRuntime: Partial<RuntimeVersions> = {}
      for (const version of Object.keys(runtime)) {
        if (version in currentRuntime) {
          if (currentRuntime[version] !== runtime[version]) {
            resultRuntime[version] = runtime[version]
          }
        } else {
          resultRuntime[version] = runtime[version]
        }
      }
      if (Object.keys(resultRuntime).length > 0) {
        result.runtime = resultRuntime
      }
    }

    if ('server' in options) {
      if (options.server) {
        if (options.server.host !== state.server?.host || options.server.port !== state.server.port) {
          result.server = options.server
        }
      } else if (state.server !== undefined) {
        result.server = options.server
      }
    }

    if ('vmOptions' in options && options.vmOptions) {
      const diff = options.vmOptions.length !== state.vmOptions.length || options.vmOptions.some((e, i) => e !== state.vmOptions[i])
      if (diff) {
        result.vmOptions = options.vmOptions
      }
    }

    if ('mcOptions' in options && options.mcOptions) {
      const diff = options.mcOptions.length !== state.mcOptions.length || options.mcOptions.some((e, i) => e !== state.mcOptions[i])
      if (diff) {
        result.mcOptions = options.mcOptions
      }
    }

    if (Object.keys(result).length > 0) {
      this.log(`Modify instance ${instancePath} (${options.name}) ${JSON.stringify(result, null, 4)}.`)
      this.state.instanceEdit({ ...result, path: instancePath })
    }
  }
}

export default InstanceService
