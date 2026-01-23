import {
  CreateInstanceOptions,
  duplicateInstance,
  InstanceDataWithTime,
  InstanceSchema,
  computeInstanceEditChanges,
  createInstance,
  type EditInstanceOptions,
  DuplicateInstanceTrackerEvents,
} from '@xmcl/instance'
import {
  InstanceModpackMetadataSchema,
  InstanceServiceKey,
  InstanceState,
  InstancesSchema,
  LockKey,
  DuplicateInstanceTask,
  type InstanceService as IInstanceService,
  type SharedState,
} from '@xmcl/runtime-api'
import { AnyError, isSystemError } from '@xmcl/utils'
import filenamify from 'filenamify'
import { existsSync } from 'fs'
import { ensureDir, readJson, rename, rm, writeFile, writeJson } from 'fs-extra'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import { Inject, LauncherAppKey, kGameDataPath, type PathResolver } from '~/app'
import { ImageStorage, kTasks, Tasks } from '~/infra'
import { VersionMetadataService } from '~/install'
import { ExposeServiceKey, ServiceStateManager, Singleton, StatefulService } from '~/service'
import { validateDirectory } from '~/util/validate'
import { LauncherApp } from '../app/LauncherApp'
import { ENOENT_ERROR, exists, isDirectory, isPathDiskRootPath, readdirEnsured } from '../util/fs'
import { requireObject, requireString } from '../util/object'
import { getTracker } from '~/util/taskHelper'
import { setTimeout } from 'timers/promises'

const INSTANCES_FOLDER = 'instances'

/**
 * Provide instance splitting service. It can split the game into multiple environment and dynamically deploy the resource to run.
 */
@ExposeServiceKey(InstanceServiceKey)
export class InstanceService extends StatefulService<InstanceState> implements IInstanceService {
  #removeHandlers: Record<string, WeakRef<() => Promise<void> | void>[]> = {}
  #onRenamedInstancePath?: (oldPath: string, newPath: string) => void

  constructor(
    @Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServiceStateManager) store: ServiceStateManager,
    @Inject(VersionMetadataService) private versionMetadataService: VersionMetadataService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(ImageStorage) private imageStore: ImageStorage,
    @Inject(kTasks) private tasks: Tasks,
  ) {
    super(
      app,
      () => store.registerStatic(new InstanceState(), InstanceServiceKey),
      async () => {
        const instancesPath = this.getAppDataPath('instances.json')
        const instanceConfig = await readJson(instancesPath)
          .then(InstancesSchema.parse)
          .catch(() => InstancesSchema.parse({}))
        const managed = (await readdirEnsured(this.getPathUnder())).map((p) => this.getPathUnder(p))

        this.log(
          `Found ${managed.length} managed instances and ${instanceConfig.instances.length} external instances.`,
        )

        const all = [...new Set([...instanceConfig.instances, ...managed])]
        const staleInstances = new Set<string>()

        const rename: [string, string][] = []
        await Promise.all(
          all.map(async (path) => {
            if (basename(path).startsWith('.')) {
              return
            }
            if (!isAbsolute(path)) {
              path = this.getPathUnder(path)
            }
            if (!(await this.loadInstance(path, (old, newPath) => rename.push([old, newPath])))) {
              staleInstances.add(path)
            }
          }),
        )

        const normalizeInstancePath = (path: string) => {
          if (this.isUnderManaged(path)) {
            const relativePath = relative(this.getPathUnder(), path)
            return relativePath
          }
          return path
        }

        const selectedInstance = instanceConfig.selectedInstance || ''

        const groups = instanceConfig.groups.map((g) =>
          typeof g === 'string'
            ? this.getPathUnder(g)
            : {
                ...g,
                instances: g.instances.map((s) => this.getPathUnder(s)),
              },
        )

        if (rename.length > 0) {
          // fix the group paths
          for (const [oldPath, newPath] of rename) {
            for (const group of groups) {
              if (typeof group === 'string') {
                if (group === oldPath) {
                  const idx = groups.indexOf(group)
                  groups[idx] = newPath
                }
              } else {
                const idx = group.instances.indexOf(oldPath)
                if (idx !== -1) {
                  group.instances[idx] = newPath
                }
              }
            }
          }
        }

        this.state.instanceGroupsSet(groups)

        this.#onRenamedInstancePath = (oldPath: string, newPath: string) => {
          const groups = this.state.groups
          for (const group of groups) {
            if (typeof group === 'string') {
              if (group === oldPath) {
                const idx = groups.indexOf(group)
                groups[idx] = newPath
              }
            } else {
              const idx = group.instances.indexOf(oldPath)
              if (idx !== -1) {
                group.instances[idx] = newPath
              }
            }
          }
          this.state.instanceGroupsSet(groups)
        }

        if (staleInstances.size > 0 || rename.length > 0) {
          await writeJson(instancesPath, {
            selectedInstance: normalizeInstancePath(selectedInstance),
            instances: instanceConfig.instances
              .filter((p) => !staleInstances.has(p))
              .map(normalizeInstancePath),
            groups,
          })
        }

        this.state.subscribe('instanceGroupsSet', async () => {
          await writeJson(instancesPath, {
            selectedInstance,
            instances: this.state.instances.map((s) => s.path).map(normalizeInstancePath),
            groups: this.state.groups.map((g) =>
              typeof g === 'string'
                ? normalizeInstancePath(g)
                : { ...g, instances: g.instances.map(normalizeInstancePath) },
            ),
          })
        })

        this.state.subscribe('instanceEdit', async ({ path }) => {
          const inst = this.state.all[path]
          await writeFile(join(path, 'instance.json'), JSON.stringify(inst, null, 2))
          this.log(`Saved instance ${path}`)
        })
      },
    )
  }

  getInstanceModpackMetadata(path: string): Promise<InstanceModpackMetadataSchema | undefined> {
    const metadataPath = join(path, 'modpack-metadata.json')
    return readJson(metadataPath)
      .then(InstanceModpackMetadataSchema.parse)
      .catch(() => undefined)
  }

  setInstanceModpackMetadata(
    path: string,
    metadata: InstanceModpackMetadataSchema | undefined,
  ): Promise<void> {
    const metadataPath = join(path, 'modpack-metadata.json')
    if (metadata) {
      return writeJson(metadataPath, InstanceModpackMetadataSchema.parse(metadata))
    } else {
      return rm(metadataPath, { force: true }).catch(() => undefined)
    }
  }

  async getSharedInstancesState(): Promise<SharedState<InstanceState>> {
    await this.initialize()
    return this.state
  }

  protected getPathUnder(...ps: string[]) {
    return this.getPath(INSTANCES_FOLDER, ...ps)
  }

  private getCandidatePath(name: string) {
    const candidate = this.getPathUnder(filenamify(name, { replacement: '_' }))
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

  registerRemoveHandler(path: string, handler: () => Promise<void> | void) {
    if (!this.#removeHandlers[path]) {
      this.#removeHandlers[path] = []
    }
    this.#removeHandlers[path].push(new WeakRef(handler))
  }

  @Singleton((v) => v)
  async loadInstance(
    path: string,
    onRename: ((old: string, newPath: string) => void) | undefined = this.#onRenamedInstancePath,
  ): Promise<boolean> {
    requireString(path)

    // Fix the wrong path if user set the name start/end with space
    path = path.trim()

    if (!isAbsolute(path)) {
      path = this.getPathUnder(path)
    }

    let option: InstanceDataWithTime

    if (!(await isDirectory(path))) {
      return false
    }

    this.log(`Start load instance under ${path}`)
    try {
      option = await readJson(join(path, 'instance.json')).then(InstanceSchema.parse)
      delete option.path
    } catch (e) {
      this.warn(`Cannot load instance json ${path}`)
      this.warn(e)
      return false
    }

    // Fix the wrong path if user set the name start/end with space
    const instance = createInstance(
      option,
      () => path,
      this.versionMetadataService.getLatestRelease,
      false,
    )
    instance.path = path

    const name = instance.name
    const expectPath = this.getPathUnder(filenamify(name, { replacement: '_' }))

    try {
      if (this.isUnderManaged(path) && expectPath !== path && !existsSync(expectPath)) {
        this.log(`Migrate instance ${path} -> ${expectPath}`)
        await rename(path, expectPath)
        // const failed = await Promise.race([
        //   await setTimeout(5_500).then(() => true),
        // ])
        // if (!failed) {
        onRename?.(path, expectPath)
        instance.path = expectPath
        // }
      }
    } catch (e) {
      this.warn(`Fail to rename instance ${path} -> ${expectPath}`)
      this.warn(e)
    }

    this.state.instanceAdd(instance)

    this.log(`Loaded instance ${instance.path}`)

    return true
  }

  async createInstance(payload: CreateInstanceOptions): Promise<string> {
    requireObject(payload)

    if (!payload.name) {
      throw new TypeError('payload.name should not be empty!')
    }

    const instance = createInstance(
      payload,
      (v) => this.getCandidatePath(v),
      this.versionMetadataService.getLatestRelease,
    )

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

    await writeJson(join(instance.path, 'instance.json'), instance)
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

    const task = this.tasks.create<DuplicateInstanceTask>({
      type: 'duplicateInstance',
      key: `duplicate-instance-${path}`,
      from: path,
      to: newPath,
    })

    try {
      await duplicateInstance({
        instancePath: path,
        newPath,
        logger: this,
        signal: task.controller.signal,
        tracker: getTracker<DuplicateInstanceTrackerEvents>(task),
      })
      task.complete()
    } catch (error) {
      task.fail(error)
      throw error
    }

    return newPath
  }

  /**
   * Delete the managed instance from the disk
   * @param path The instance path
   */
  /**
   * Delete the managed instance from the disk
   * @param path The instance path
   */
  async deleteInstance(path: string, deleteData = true) {
    await this.initialize()
    requireString(path)

    const isManaged = this.isUnderManaged(path)
    const lock = this.mutex.of(LockKey.instanceRemove(path))
    const instanceLock = this.mutex.of(LockKey.instance(path))
    if (isManaged && (await exists(path))) {
      await lock.runExclusive(async () => {
        instanceLock.cancel()
        const oldHandlers = this.#removeHandlers[path]
        for (const handlerRef of oldHandlers || []) {
          handlerRef.deref()?.()
        }
        if (deleteData) {
          try {
            await rm(path, { recursive: true, force: true, maxRetries: 1 })
          } catch (e) {
            if (isSystemError(e) && (e.code === ENOENT_ERROR || e.code === 'EPERM')) {
              this.warn(`Fail to remove instance ${path}`)
            } else {
              if ((e as any).name === 'Error') {
                ;(e as any).name = 'InstanceDeleteError'
              }
              throw e
            }
          }
        } else {
          // Rename to hidden
          const name = basename(path)
          const newPath = join(dirname(path), '.' + name)
          await rename(path, newPath).catch(() => undefined)
        }

        this.#removeHandlers[path] = []
      })
    }

    this.state.instanceRemove(path)
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
    let state =
      this.state.all[instancePath] || this.state.instances.find((i) => i.path === instancePath)

    if (!state) {
      // Try to force load the instance
      await this.loadInstance(instancePath).catch(() => false)
      state =
        this.state.all[instancePath] || this.state.instances.find((i) => i.path === instancePath)

      if (!state) {
        this.error(
          new AnyError(
            'InstanceNotFoundError',
            `Fail to find ${instancePath}. Existed: ${Object.keys(this.state.all).join(', ')}.`,
          ),
        )
        return
      }
    }

    if (options.name) {
      if (this.isUnderManaged(instancePath)) {
        const newPath = join(dirname(instancePath), options.name)
        if (newPath !== instancePath) {
          if (this.state.instances.some((i) => i.path === newPath)) {
            options.name = undefined
            this.error(new AnyError('InstanceNameDuplicatedError'))
          }
        }
      }
    }

    const result = await computeInstanceEditChanges(state, options, async (path: string) =>
      this.imageStore.addImage(path).catch((e) => {
        this.error(e)
        return ''
      }),
    )

    if (Object.keys(result).length > 0) {
      this.log(
        `Modify instance ${instancePath} (${options.name}) ${JSON.stringify(result, null, 4)}.`,
      )
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
    const err = await validateDirectory(this.app.platform, path, true)
    if (err && err !== 'exists') {
      return err
    }
    await this.initialize()
    if (this.state.all[path]) {
      return undefined
    }
    return (await this.loadInstance(path).catch(() => 'bad')) ? undefined : 'bad'
  }
}
