import { ResolvedVersion, Version } from '@xmcl/core'
import { CreateInstanceOption, EditInstanceOptions, InstanceService as IInstanceService, Instance, InstanceException, InstanceSchema, InstanceServiceKey, InstanceState, InstancesSchema, MutableState, RuntimeVersions, createTemplate, filterForgeVersion, filterOptifineVersion, getExpectVersion, isFabricLoaderLibrary, isForgeLibrary, isOptifineLibrary } from '@xmcl/runtime-api'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { copy, copyFile, ensureDir, readdir, readlink, rename, rm, stat } from 'fs-extra'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { ImageStorage } from '~/imageStore'
import { VersionMetadataService } from '~/install'
import { readLaunchProfile } from '~/launchProfile'
import { ResourceWorker, kResourceWorker } from '~/resource'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { AnyError } from '~/util/error'
import { validateDirectory } from '~/util/validate'
import { LauncherApp } from '../app/LauncherApp'
import { exists, isDirectory, isPathDiskRootPath, linkWithTimeoutOrCopy, readdirEnsured } from '../util/fs'
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

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(VersionMetadataService) private versionMetadataService: VersionMetadataService,
    @Inject(kResourceWorker) private worker: ResourceWorker,
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

      // if (Object.keys(state.all).length === 0) {
      //   const initial = this.app.getInitialInstance()
      //   if (initial) {
      //     try {
      //       await this.addExternalInstance(initial)
      //       const instance = Object.values(state.all)[0]
      //       // await this.mountInstance(instance.path)
      //       await this.instancesFile.write({ instances: Object.keys(this.state.all).map(normalizeInstancePath), selectedInstance: normalizeInstancePath(instance.path) })
      //     } catch (e) {
      //       this.error(new Error(`Fail to initialize to ${initial}`, { cause: e }))
      //       await this.createAndMount({ name: 'Minecraft' })
      //     }
      //   } else {
      //     this.log('Cannot find any instances, try to init one default modpack.')
      //     await this.createAndMount({ name: 'Minecraft' })
      //   }
      // }

      this.state
        .subscribe('instanceAdd', async (payload: Instance) => {
          await this.instanceFile.write(join(payload.path, 'instance.json'), payload)
          // await this.instancesFile.write({ instances: Object.keys(this.state.all).map(normalizeInstancePath), selectedInstance: normalizeInstancePath(this.state.path) })
          this.log(`Saved new instance ${payload.path}`)
        })
        .subscribe('instanceEdit', async ({ path }) => {
          const inst = this.state.all[path]
          await this.instanceFile.write(join(path, 'instance.json'), inst)
          this.log(`Saved instance ${path}`)
        })
    })

    this.instancesFile = createSafeFile(this.getAppDataPath('instances.json'), InstancesSchema, this, [this.getPath('instances.json')])
  }

  async getSharedInstancesState(): Promise<MutableState<InstanceState>> {
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
      throw new InstanceException({
        type: 'instanceNameRequired',
      })
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
      await ensureDir(instance.path)
    }
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
      await Promise.all(files.map(f => linkWithTimeoutOrCopy(join(modDirSrc, f), join(newPath, 'mods', f))))
    }
    if (hasResourcepacks) {
      const resourcepacksDirSrc = join(path, 'resourcepacks')
      const status = await stat(resourcepacksDirSrc)
      if (!status.isSymbolicLink()) {
        // hard link all files
        await ensureDir(join(newPath, 'resourcepacks'))
        const files = await readdir(resourcepacksDirSrc)
        await Promise.all(files.map(f => linkWithTimeoutOrCopy(join(resourcepacksDirSrc, f), join(newPath, 'resourcepacks', f))))
      }
    }
    if (hasShaderpacks) {
      const shaderpacksDirSrc = join(path, 'shaderpacks')
      const status = await stat(shaderpacksDirSrc)
      if (!status.isSymbolicLink()) {
        // hard link all files
        await ensureDir(join(newPath, 'shaderpacks'))
        const files = await readdir(shaderpacksDirSrc)
        await Promise.all(files.map(f => linkWithTimeoutOrCopy(join(shaderpacksDirSrc, f), join(newPath, 'shaderpacks', f))))
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

    this.state.instanceRemove(path)

    const isManaged = this.isUnderManaged(path)
    if (isManaged && await exists(path)) {
      await rm(path, { recursive: true, force: true })
    }
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
        const error = new InstanceException({
          type: 'instanceNotFound',
          path: instancePath,
        })
        this.error(new AnyError('InstanceNotFoundError',
          `Fail to find ${instancePath}. Existed: ${Object.keys(this.state.all).join(', ')}.`,
        ))
        throw error
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
            throw new InstanceException({
              type: 'instanceNameDuplicated',
              path: instancePath,
              name: options.name,
            })
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

  @Singleton()
  async addExternalInstance(path: string): Promise<boolean> {
    const err = await validateDirectory(this.app.platform, path)
    if (err && err !== 'exists') {
      throw new InstanceException({
        type: 'instancePathInvalid',
        path,
        reason: err,
      })
    }

    if (this.state.all[path]) {
      this.log(`Skip to link already managed instance ${path}`)
      return false
    }

    if (resolve(path).startsWith(this.getPath()) || this.getPath().startsWith(resolve(path))) {
      this.log(`Skip to add instance from root ${path}`)
      return false
    }

    // copy assets, library and versions
    await this.worker.copyPassively([
      { src: resolve(path, 'libraries'), dest: this.getPath('libraries') },
      { src: resolve(path, 'assets'), dest: this.getPath('assets') },
    ])

    const versions = await readdir(resolve(path, 'versions')).catch(() => [])
    const resolveVersions = [] as ResolvedVersion[]
    const profile = await readLaunchProfile(path).catch(() => undefined)
    let isVersionIsolated = false
    await Promise.all(versions.map(async (v) => {
      try {
        // only resolve valid version
        const version = await Version.parse(path, v)
        resolveVersions.push(version)
        const versionRoot = resolve(path, 'versions', v)

        const versionJson = resolve(versionRoot, `${v}.json`)
        const versionJar = resolve(versionRoot, `${v}.jar`)
        await Promise.all([
          copyFile(versionJar, this.getPath('versions', v, `${v}.jar`)).catch(() => undefined),
          copyFile(versionJson, this.getPath('versions', v, `${v}.json`)).catch(() => undefined),
        ])

        const files = (await readdir(versionRoot)).filter(f => f !== '.DS_Store' && f !== `${v}.json` && f !== `${v}.jar`)
        if (files.some(f => f === 'saves' || f === 'mods' || f === 'options.txt' || f === 'config' || f === 'PCL')) {
          // this is an version isolation
          const options: CreateInstanceOption = {
            path: versionRoot,
            name: version.id,
          }
          if (profile) {
            for (const p of Object.values(profile.profiles)) {
              if (p.lastVersionId === version.id) {
                options.name = p.name
                options.java = p.javaDir
                options.vmOptions = p.javaArgs?.split(' ') || []
                break
              }
            }
          }
          options.runtime = {
            minecraft: version.minecraftVersion,
            forge: filterForgeVersion(version.libraries.find(isForgeLibrary)?.version ?? ''),
            fabricLoader: version.libraries.find(isFabricLoaderLibrary)?.version ?? '',
            optifine: filterOptifineVersion(version.libraries.find(isOptifineLibrary)?.version ?? ''),
          }
          isVersionIsolated = true
          await this.createInstance(options)
        }
      } catch (e) {
        if (e instanceof Error) this.error(e)
        // TODO: handle
      }
    }))

    if (!isVersionIsolated) {
      const options: CreateInstanceOption = {
        path,
        name: '',
      }
      if (profile) {
        const sorted = Object.values(profile.profiles).sort((a, b) =>
          // @ts-ignore
          new Date(b.lastUsed) - new Date(a.lastUsed))
        let version: ResolvedVersion | undefined
        for (const p of sorted) {
          const id = p.lastVersionId
          version = resolveVersions.find(v => v.id === id)
          options.name = p.name
          options.java = p.javaDir
          options.vmOptions = p.javaArgs?.split(' ') || []
          if (version) {
            break
          }
        }
        if (version) {
          options.runtime = {
            minecraft: version.minecraftVersion,
            forge: filterForgeVersion(version.libraries.find(isForgeLibrary)?.version ?? ''),
            fabricLoader: version.libraries.find(isFabricLoaderLibrary)?.version ?? '',
            optifine: filterOptifineVersion(version.libraries.find(isOptifineLibrary)?.version ?? ''),
          }
        } else {
          options.runtime = {
            minecraft: this.versionMetadataService.getLatestRelease(),
          }
        }
      } else {
        const version = resolveVersions[0]
        if (version) {
          options.runtime = {
            minecraft: version.minecraftVersion,
            forge: filterForgeVersion(version.libraries.find(isForgeLibrary)?.version ?? ''),
            fabricLoader: version.libraries.find(isFabricLoaderLibrary)?.version ?? '',
            optifine: filterOptifineVersion(version.libraries.find(isOptifineLibrary)?.version ?? ''),
          }
        } else {
          options.runtime = {
            minecraft: this.versionMetadataService.getLatestRelease(),
          }
        }
      }

      const dirPath = dirname(path)
      const folderName = basename(dirPath)
      if (folderName === 'minecraft' || folderName === '.minecraft') {
        const name = getExpectVersion(options.runtime)
        options.name = name
      } else {
        options.name = isPathDiskRootPath(dirPath) ? basename(path) : folderName
      }

      await this.createInstance(options)
    }

    return true
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
