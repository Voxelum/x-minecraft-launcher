import { CreateInstanceOption, EditInstanceOptions, InstanceService as IInstanceService, InstanceSchema, InstanceServiceKey, InstanceState, InstancesSchema, SharedState, RuntimeVersions, createTemplate, LockKey } from '@xmcl/runtime-api'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { copy, ensureDir, readdir, readlink, rename, rm, stat } from 'fs-extra'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { ImageStorage } from '~/imageStore'
import { VersionMetadataService } from '~/install'
import { ExposeServiceKey, ServiceStateManager, StatefulService } from '~/service'
import { AnyError, isSystemError } from '~/util/error'
import { validateDirectory } from '~/util/validate'
import { LauncherApp } from '../app/LauncherApp'
import { ENOENT_ERROR, exists, isDirectory, isPathDiskRootPath, linkWithTimeoutOrCopy, readdirEnsured } from '../util/fs'
import { assignShallow, requireObject, requireString } from '../util/object'
import { SafeFile, createSafeFile, createSafeIO } from '../util/persistance'

const INSTANCES_FOLDER = 'instances'

/**
 * Provide instance splitting service. It can split the game into multiple environment and dynamically deploy the resource to run.
 */
@ExposeServiceKey(InstanceServiceKey)
export class InstanceService extends StatefulService<InstanceState> implements IInstanceService {
  protected readonly instancesFile: SafeFile<InstancesSchema>
  protected readonly instanceFile = createSafeIO(InstanceSchema, this)
  #removeHandlers: Record<string, (WeakRef<() => Promise<void> | void>)[]> = {}

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(VersionMetadataService) private versionMetadataService: VersionMetadataService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(ImageStorage) private imageStore: ImageStorage,
  ) {
    super(app, () => store.registerStatic(new InstanceState(), InstanceServiceKey), async () => {
      const instanceConfig = await this.instancesFile.read()
      const managed = (await readdirEnsured(this.getPathUnder())).map(p => this.getPathUnder(p))

      this.log(`Found ${managed.length} managed instances and ${instanceConfig.instances.length} external instances.`)

      const all = [...new Set([...instanceConfig.instances, ...managed])]
      const staleInstances = new Set<string>()

      await Promise.all(all.map(async (path) => {
        if (basename(path).startsWith('.')) {
          return
        }
        if (!await this.loadInstance(path)) {
          staleInstances.add(path)
        }
      }))

      const normalizeInstancePath = (path: string) => {
        if (this.isUnderManaged(path)) {
          const relativePath = relative(this.getPathUnder(), path)
          return relativePath
        }
        return path
      }

      const selectedInstance = instanceConfig.selectedInstance || ''

      if (staleInstances.size > 0) {
        await this.instancesFile.write({
          selectedInstance: normalizeInstancePath(selectedInstance),
          instances: instanceConfig.instances.filter(p => !staleInstances.has(p)).map(normalizeInstancePath),
        })
      }

      this.state
        .subscribe('instanceEdit', async ({ path }) => {
          const inst = this.state.all[path]
          await this.instanceFile.write(join(path, 'instance.json'), inst)
          this.log(`Saved instance ${path}`)
        })
    })

    this.instancesFile = createSafeFile(this.getAppDataPath('instances.json'), InstancesSchema, this, [this.getPath('instances.json')])
  }

  async getSharedInstancesState(): Promise<SharedState<InstanceState>> {
    await this.initialize()
    return this.state
  }

  protected getPathUnder(...ps: string[]) {
    return this.getPath(INSTANCES_FOLDER, ...ps)
  }

  private getCandidatePath(name: string) {
    const candidate = this.getPathUnder(filenamify(name))
    if (!existsSync(candidate)) {
      return candidate
    } else {
      // find the first available path
      let i = 1
      while (existsSync(candidate + i)) {
        i++
      }
      return candidate + i
    }
  }

  async loadInstance(path: string) {
    requireString(path)

    // Fix the wrong path if user set the name start/end with space
    path = path.trim()

    if (!isAbsolute(path)) {
      path = this.getPathUnder(path)
    }

    let option: InstanceSchema

    if (!await isDirectory(path)) {
      return false
    }
    this.log(`Start load instance under ${path}`)
    try {
      option = await this.instanceFile.read(join(path, 'instance.json'))
    } catch (e) {
      this.warn(`Cannot load instance json ${path}`)
      this.warn(e)
      return false
    }

    // Fix the wrong path if user set the name start/end with space
    option.name = option.name.trim()

    const name = option.name
    const expectPath = this.getPathUnder(filenamify(name))

    try {
      if (this.isUnderManaged(path) && expectPath !== path && !existsSync(expectPath)) {
        this.log(`Migrate instance ${path} -> ${expectPath}`)
        await rename(path, expectPath)
        path = expectPath
      }
    } catch (e) {
      this.warn(`Fail to rename instance ${path} -> ${expectPath}`)
      this.warn(e)
    }

    const instance = createTemplate()

    instance.author = instance.author || ''

    assignShallow(instance, option)
    if (option.runtime) {
      assignShallow(instance.runtime, option.runtime)
    }
    instance.assignMemory = option.assignMemory
    instance.showLog = option.showLog
    instance.hideLauncher = option.hideLauncher
    instance.fastLaunch = option.fastLaunch
    instance.icon = option.icon
    instance.maxMemory = option.maxMemory
    instance.minMemory = option.minMemory
    instance.vmOptions = option.vmOptions
    instance.mcOptions = option.mcOptions
    instance.creationDate = option.creationDate
    instance.lastAccessDate = option.lastAccessDate
    instance.disableAuthlibInjector = option.disableAuthlibInjector
    instance.disableElybyAuthlib = option.disableElybyAuthlib
    if (option.resolution) {
      if (instance.resolution) {
        instance.resolution.width = option.resolution.width
        instance.resolution.height = option.resolution.height
        instance.resolution.fullscreen = option.resolution.fullscreen
      } else {
        instance.resolution = option.resolution
      }
    }

    instance.runtime.minecraft = instance.runtime.minecraft || this.versionMetadataService.getLatestRelease()
    instance.upstream = option.upstream
    instance.playtime = option.playtime
    instance.lastPlayedDate = option.lastPlayedDate

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

    if (!payload.name) {
      throw new TypeError('payload.name should not be empty!')
    }

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

    payload.name = payload.name.trim()

    if (!payload.path) {
      instance.path = this.getCandidatePath(payload.name)
    }

    instance.runtime.minecraft = instance.runtime.minecraft || this.versionMetadataService.getLatestRelease()
    instance.creationDate = Date.now()
    instance.lastAccessDate = Date.now()

    instance.author = payload.author ?? instance.author
    instance.description = payload.description ?? instance.description
    instance.showLog = payload.showLog ?? instance.showLog
    instance.upstream = payload.upstream
    instance.icon = payload.icon ?? ''

    if (!isPathDiskRootPath(instance.path)) {
      await ensureDir(instance.path).catch(() => undefined)
    }

    const forceFolder = true
    if (forceFolder || payload.resourcepacks) {
      await ensureDir(join(instance.path, 'resourcepacks')).catch(() => undefined)
    }
    if (forceFolder || payload.shaderpacks) {
      await ensureDir(join(instance.path, 'shaderpacks')).catch(() => undefined)
    }

    await this.instanceFile.write(join(instance.path, 'instance.json'), instance)
    this.state.instanceAdd(instance)

    this.log('Created instance with option')
    this.log(JSON.stringify(instance, null, 4))

    return instance.path
  }

  async duplicateInstance(path: string) {
    requireString(path)

    if (!this.state.all[path]) {
      return ''
    }

    const instance = this.state.all[path]
    const newPath = this.getCandidatePath(instance.name || basename(path))
    const newName = basename(newPath)

    await this.createInstance({
      ...JSON.parse(JSON.stringify(instance)),
      path: newPath,
      name: newName,
    })

    let hasMods = false
    let hasResourcepacks = false
    let hasShaderpacks = false
    await copy(path, newPath, {
      filter: async (src, dest) => {
        const linked = await readlink(src).catch(() => '')

        if (linked) {
          return false
        }

        const relativePath = relative(path, src).replaceAll('\\', '/')
        if (relativePath.startsWith('mods')) {
          hasMods = true
          return false
        }
        if (relativePath.startsWith('resourcepacks')) {
          hasResourcepacks = true
          return false
        }
        if (relativePath.startsWith('shaderpacks')) {
          hasShaderpacks = true
          return false
        }
        return true
      },
    })
    if (hasMods) {
      const modDirSrc = join(path, 'mods')
      await ensureDir(join(newPath, 'mods'))
      // hard link all source to new path
      const files = await readdir(modDirSrc)
      await Promise.allSettled(files.map(f => linkWithTimeoutOrCopy(join(modDirSrc, f), join(newPath, 'mods', f))))
    }
    if (hasResourcepacks) {
      const resourcepacksDirSrc = join(path, 'resourcepacks')
      const status = await stat(resourcepacksDirSrc)
      if (!status.isSymbolicLink()) {
        // hard link all files
        await ensureDir(join(newPath, 'resourcepacks'))
        const files = await readdir(resourcepacksDirSrc)
        await Promise.allSettled(files.map(f => linkWithTimeoutOrCopy(join(resourcepacksDirSrc, f), join(newPath, 'resourcepacks', f))))
      }
    }
    if (hasShaderpacks) {
      const shaderpacksDirSrc = join(path, 'shaderpacks')
      const status = await stat(shaderpacksDirSrc)
      if (!status.isSymbolicLink()) {
        // hard link all files
        await ensureDir(join(newPath, 'shaderpacks'))
        const files = await readdir(shaderpacksDirSrc)
        await Promise.allSettled(files.map(f => linkWithTimeoutOrCopy(join(shaderpacksDirSrc, f), join(newPath, 'shaderpacks', f))))
      }
    }

    return newPath
  }

  /**
   * Delete the managed instance from the disk
   * @param path The instance path
   */
  async deleteInstance(path: string) {
    await this.initialize()
    requireString(path)

    const isManaged = this.isUnderManaged(path)
    const lock = this.mutex.of(LockKey.instanceRemove(path))
    const instanceLock = this.mutex.of(LockKey.instance(path))
    if (isManaged && await exists(path)) {
      await lock.runExclusive(async () => {
        instanceLock.cancel()
        const oldHandlers = this.#removeHandlers[path]
        for (const handlerRef of oldHandlers || []) {
          handlerRef.deref()?.()
        }
        try {
          await rm(path, { recursive: true, force: true, maxRetries: 1 })
        } catch (e) {
          if (isSystemError(e) && e.code === ENOENT_ERROR) {
            this.warn(`Fail to remove instance ${path}`)
          } else {
            if ((e as any).name === 'Error') {
              (e as any).name = 'InstanceDeleteError'
            }
            throw e
          }
        }

        this.#removeHandlers[path] = []
      })
    }

    this.state.instanceRemove(path)
  }

  registerRemoveHandler(path: string, handler: () => Promise<void> | void) {
    if (!this.#removeHandlers[path]) {
      this.#removeHandlers[path] = []
    }
    this.#removeHandlers[path].push(new WeakRef(handler))
  }

  /**
   * Edit the instance. If the `path` is not present, it will edit the current selected instance.
   * Otherwise, it will edit the instance on the provided path
   */
  async editInstance(options: EditInstanceOptions & { instancePath: string }) {
    await this.initialize()

    requireObject(options)

    const instancePath = options.instancePath

    if (!instancePath) {
      return
    }
    let state = this.state.all[instancePath] || this.state.instances.find(i => i.path === instancePath)

    if (!state) {
      // Try to force load the instance
      await this.loadInstance(instancePath).catch(() => false)
      state = this.state.all[instancePath] || this.state.instances.find(i => i.path === instancePath)

      if (!state) {
        this.error(new AnyError('InstanceNotFoundError',
          `Fail to find ${instancePath}. Existed: ${Object.keys(this.state.all).join(', ')}.`,
        ))
        return
      }
    }

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

    if (options.name) {
      if (this.isUnderManaged(instancePath)) {
        const newPath = join(dirname(instancePath), options.name)
        if (newPath !== instancePath) {
          if (this.state.instances.some(i => i.path === newPath)) {
            options.name = undefined
            this.error(new AnyError('InstanceNameDuplicatedError'))
          }
        }
      }
    }

    if (typeof options.fileApi === 'string' && options.fileApi !== state.fileApi) {
      result.fileApi = options.fileApi
    }

    if ('maxMemory' in options && options.maxMemory !== state.maxMemory) {
      if (typeof options.maxMemory === 'undefined') {
        result.maxMemory = undefined
      } else if (typeof options.maxMemory === 'number') {
        result.maxMemory = Math.floor(options.maxMemory > 0 ? options.maxMemory : 0)
      } else {
        throw new Error(`Invalid Argument: Expect maxMemory to be number or undefined! Got ${typeof options.maxMemory}.`)
      }
    }
    if ('minMemory' in options && options.minMemory !== state.minMemory) {
      if (typeof options.minMemory === 'undefined') {
        result.minMemory = undefined
      } else if (typeof options.minMemory === 'number') {
        result.minMemory = Math.floor(options.minMemory > 0 ? options.minMemory : 0)
      } else {
        throw new Error(`Invalid Argument: Expect minMemory to be number or undefined! Got ${typeof options.maxMemory}.`)
      }
    }
    if ('prependCommand' in options && options.prependCommand !== state.prependCommand) {
      result.prependCommand = options.prependCommand
    }
    if ('assignMemory' in options && options.assignMemory !== state.assignMemory) {
      result.assignMemory = options.assignMemory
    }
    if ('showLog' in options && options.showLog !== state.showLog) {
      result.showLog = options.showLog
    }
    if ('hideLauncher' in options && options.hideLauncher !== state.hideLauncher) {
      result.hideLauncher = options.hideLauncher
    }
    if ('fastLaunch' in options && options.fastLaunch !== state.fastLaunch) {
      result.fastLaunch = options.fastLaunch
    }
    if ('disableAuthlibInjector' in options && options.disableAuthlibInjector !== state.disableAuthlibInjector) {
      result.disableAuthlibInjector = options.disableAuthlibInjector
    }
    if ('disableElybyAuthlib' in options && options.disableElybyAuthlib !== state.disableElybyAuthlib) {
      result.disableElybyAuthlib = options.disableElybyAuthlib
    }

    if ('runtime' in options && options.runtime) {
      const runtime = options.runtime
      const currentRuntime = state.runtime
      const resultRuntime: Partial<RuntimeVersions> = {}
      for (const version of Object.keys(runtime)) {
        if (version in currentRuntime) {
          if (currentRuntime[version] !== runtime[version]) {
            resultRuntime[version] = runtime[version] || ''
          }
        } else {
          resultRuntime[version] = runtime[version] || ''
        }
      }
      if (Object.keys(resultRuntime).length > 0) {
        result.runtime = resultRuntime
      }
    }

    if (result.runtime && state.version && typeof result.version === 'undefined') {
      // Reset the version if the runtime is changed
      result.version = ''
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

    if ('vmOptions' in options) {
      const hasDiff = typeof options.vmOptions !== typeof state.vmOptions || options.vmOptions?.length !== state.vmOptions?.length || options.vmOptions?.some((e, i) => e !== state.vmOptions?.[i])
      if (hasDiff) {
        result.vmOptions = options.vmOptions
      }
    }

    if ('mcOptions' in options) {
      const hasDiff = typeof options.mcOptions !== typeof state.mcOptions || options.mcOptions?.length !== state.mcOptions?.length || options.mcOptions?.some((e, i) => e !== state.mcOptions?.[i])
      if (hasDiff) {
        result.mcOptions = options.mcOptions
      }
    }

    if ('env' in options) {
      const hasDiff = typeof options.env !== typeof state.env || (options.env && state.env && Object.keys(options.env).some(k => options.env?.[k] !== state.env?.[k]))
      if (hasDiff) {
        result.env = options.env
      }
    }

    if ('icon' in result && result.icon) {
      try {
        const iconURL = new URL(result.icon)
        const path = iconURL.searchParams.get('path')
        if (iconURL.host === 'launcher' && iconURL.pathname === '/media' && path) {
          result.icon = await this.imageStore.addImage(path)
        }
      } catch (e) {
        if (e instanceof Error) this.error(e)
      }
    }

    if (Object.keys(result).length > 0) {
      this.log(`Modify instance ${instancePath} (${options.name}) ${JSON.stringify(result, null, 4)}.`)
      this.state.instanceEdit({ ...result, path: instancePath })
    }
  }

  isUnderManaged(path: string) {
    return resolve(path).startsWith(resolve(this.getPathUnder()))
  }

  async acquireInstanceById(id: string): Promise<string> {
    id = filenamify(id)
    this.log(`Acquire instance by id ${id}`)
    const instancePath = this.getPathUnder(id)
    if (this.state.all[instancePath]) {
      this.log(`Acquire existed instance ${id} -> ${instancePath}`)
      return instancePath
    }
    const path = await this.createInstance({
      path: instancePath,
      name: id,
    })
    this.log(`Create new instance ${id} -> ${instancePath}`)
    return path
  }

  async validateInstancePath(path: string) {
    const err = await validateDirectory(this.app.platform, path)
    if (err && err !== 'exists') {
      return err
    }
    if (this.state.all[path]) {
      return undefined
    }
    return await this.loadInstance(path).catch(() => 'bad') ? undefined : 'bad'
  }
}
