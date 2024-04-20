import { InstanceModsService as IInstanceModsService, ResourceService as IResourceService, InstallModsOptions, InstanceModUpdatePayload, InstanceModUpdatePayloadAction, InstanceModsServiceKey, InstanceModsState, MutableState, PartialResourceHash, Resource, ResourceDomain, getInstanceModStateKey, isModResource } from '@xmcl/runtime-api'
import { ensureDir, rename, stat, unlink } from 'fs-extra'
import watch from 'node-watch'
import { dirname, join } from 'path'
import { Inject, LauncherAppKey } from '~/app'
import { ResourceService } from '~/resource'
import { shouldIgnoreFile } from '~/resource/core/pathUtils'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { AnyError, isSystemError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { AggregateExecutor } from '../util/aggregator'
import { linkWithTimeoutOrCopy, readdirIfPresent } from '../util/fs'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
@ExposeServiceKey(InstanceModsServiceKey)
export class InstanceModsService extends AbstractService implements IInstanceModsService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
  ) {
    super(app)

    this.resourceService.registerInstaller(ResourceDomain.Mods, async (resource, instancePath) => {
      await this.install({
        mods: [resource],
        path: instancePath,
      })
    })
  }

  async showDirectory(path: string): Promise<void> {
    await this.app.shell.openDirectory(join(path, 'mods'))
  }

  async watch(instancePath: string): Promise<MutableState<InstanceModsState>> {
    if (!instancePath) throw new AnyError('WatchModError', 'Cannot watch instance mods on empty path')
    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(getInstanceModStateKey(instancePath), async ({ defineAsyncOperation }) => {
      const updateMod = new AggregateExecutor<InstanceModUpdatePayload, InstanceModUpdatePayload[]>(v => v,
        (all) => {
          const badResources = [] as any[]
          for (const s of state.mods) {
            if (!s.path) {
              badResources.push(s)
            }
          }
          for (const [r, a] of all) {
            if (a === InstanceModUpdatePayloadAction.Remove || a === InstanceModUpdatePayloadAction.Upsert) {
              if (!r.path) {
                badResources.push(r)
              }
            }
          }
          state.instanceModUpdates(all)
          if (badResources.length > 0) {
            this.error(new AnyError('InstanceModUpdateError', 'Some resources are not valid', {}, { resources: badResources }))
          }
        },
        500)

      const state = new InstanceModsState()
      const pending: Set<string> = new Set()

      const processUpdate = defineAsyncOperation(async (filePath: string, retryLimit = 7) => {
        try {
          if (pending.has(filePath)) return
          pending.add(filePath)

          const [resource] = await this.resourceService.importResources([{ path: filePath, domain: ResourceDomain.Mods }], true)
          if (resource && isModResource(resource)) {
            this.log(`Instance mod add ${filePath}`)
          } else {
            this.warn(`Non mod resource added in /mods directory! ${filePath}`)
          }
          updateMod.push([resource, InstanceModUpdatePayloadAction.Upsert])
          pending.delete(filePath)
        } catch (e) {
          if (isSystemError(e) && (e.code === 'EMFILE' || e.code === 'EBUSY') && retryLimit > 0) {
            // Retry
            setTimeout(() => processUpdate(filePath, retryLimit - 1), Math.random() * 2000 + 1000)
          } else {
            this.error(new AnyError('InstanceModAddError', `Fail to add instance mod ${filePath}`, { cause: e }))
            pending.delete(filePath)
          }
        }
      })
      const processRemove = (filePath: string) => {
        const target = state.mods.find(r => r.path === filePath)
        if (target) {
          this.log(`Instance mod remove ${filePath}`)
          updateMod.push([target, InstanceModUpdatePayloadAction.Remove])
        } else {
          this.warn(`Cannot remove the mod ${filePath} as it's not found in memory cache!`)
        }
      }

      const listener = this.resourceService as IResourceService
      const onResourceUpdate = (res: PartialResourceHash[]) => {
        if (res) {
          updateMod.push([res, InstanceModUpdatePayloadAction.Update])
        } else {
          this.error(new AnyError('InstanceModUpdateError', 'Cannot update instance mods as the resource is empty'))
        }
      }
      listener
        .on('resourceUpdate', onResourceUpdate)

      const basePath = join(instancePath, 'mods')
      await ensureDir(basePath)
      await this.resourceService.whenReady(ResourceDomain.Mods)
      const scan = async (dir: string) => {
        const files = (await readdirIfPresent(dir))
          .filter((file) => !shouldIgnoreFile(file))
          .map((file) => join(dir, file))

        const peekCount = 100
        const peekChunks = files.slice(0, peekCount)
        for (const file of files.slice(peekCount)) {
          processUpdate(file)
        }

        const resources = await this.resourceService.importResources(peekChunks.map(f => ({ path: f, domain: ResourceDomain.Mods })), true)
        return resources.map((r, i) => ({ ...r, path: peekChunks[i] }))
      }
      state.mods = await scan(basePath)

      const watcher = watch(basePath, async (event, filePath) => {
        if (shouldIgnoreFile(filePath) || filePath === basePath) return
        if (event === 'update') {
          processUpdate(filePath)
        } else {
          processRemove(filePath)
        }
      })

      watcher.on('close', () => {
        this.log(`Unwatch on instance mods: ${basePath}`)
      })

      this.log(`Mounted on instance mods: ${basePath}`)

      return [state, () => {
        watcher.close()
        listener.removeListener('resourceAdd', onResourceUpdate)
          .removeListener('resourceUpdate', onResourceUpdate)
      }, async () => {
        // relvaidate
        const files = await readdirIfPresent(basePath)
        const expectFiles = files.filter((file) => !shouldIgnoreFile(file)).map((file) => join(basePath, file))
        const current = state.mods.length
        if (current !== expectFiles.length) {
          this.log(`Instance mods count mismatch: ${current} vs ${expectFiles.length}`)
          // Find differences
          const currentFiles = state.mods.map(r => r.path)
          const added = expectFiles.filter(f => !currentFiles.includes(f))
          const removed = currentFiles.filter(f => !expectFiles.includes(f))
          if (added.length > 0) {
            this.log(`Instance mods added: ${added.length}`)
            for (const f of added) { processUpdate(f) }
          }
          if (removed.length > 0) {
            this.log(`Instance mods removed: ${removed.length}`)
            for (const f of removed) { processRemove(f) }
          }
        }
      }]
    })
  }

  async install({ mods: resources, path }: InstallModsOptions) {
    const promises: Promise<void>[] = []
    this.log(`Install ${resources.length} to ${path}/mods`)
    for (const res of resources) {
      if (res.domain !== ResourceDomain.Mods) {
        this.warn(`Install non mod resource ${res.name} as it's not a mod`)
      }
      const src = res.storedPath || res.path
      const dest = join(path, ResourceDomain.Mods, res.fileName)
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest).catch(() => undefined)])

      let promise: Promise<any> | undefined
      if (!destStat) {
        promise = linkWithTimeoutOrCopy(src, dest)
      } else if (srcStat.ino !== destStat.ino) {
        promise = unlink(dest).then(() => linkWithTimeoutOrCopy(src, dest))
      }
      if (promise) {
        promises.push(promise.catch((e) => {
          this.error(new Error(`Cannot deploy the resource from ${src} to ${dest}`, { cause: e }))
          throw e
        }))
      }
    }
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  async enable({ mods, path }: InstallModsOptions): Promise<void> {
    this.log(`Enable ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      if (dirname(resource.path) !== instanceModsDir) {
        this.warn(`Skip to enable unmanaged mod file on ${resource.path}!`)
      } else if (!resource.path.endsWith('.disabled')) {
        this.warn(`Skip to enable enabled mod file on ${resource.path}!`)
      } else {
        promises.push(rename(resource.path, resource.path.substring(0, resource.path.length - '.disabled'.length)).catch(e => {
          // if (e.code === 'ENOENT') {
          //   // Force remove
          //   this.state.instanceModRemove([resource])
          // }
        }))
      }
    }
    await Promise.all(promises)
  }

  async disable({ mods, path }: InstallModsOptions) {
    this.log(`Disable ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      if (dirname(resource.path) !== instanceModsDir) {
        this.warn(`Skip to disable unmanaged mod file on ${resource.path}!`)
      } else if (resource.path.endsWith('.disabled')) {
        this.warn(`Skip to disable disabled mod file on ${resource.path}!`)
      } else {
        promises.push(rename(resource.path, resource.path + '.disabled').catch(e => {
          // if (e.code === 'ENOENT') {
          //   // Force remove
          //   this.state.instanceModRemove([resource])
          // }
        }))
      }
    }
    await Promise.all(promises)
  }

  async uninstall(options: InstallModsOptions) {
    const { mods, path } = options
    this.log(`Uninstall ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      // if (dirname(resource.path) !== instanceModsDir) {
      //   const founded = this.state.mods.find(m => m.ino === resource.ino) ??
      //     this.state.mods.find(m => m.hash === resource.hash)
      //   if (founded && founded.path !== resource.path) {
      //     const realPath = join(instanceModsDir, founded.fileName)
      //     if (existsSync(realPath)) {
      //       promises.push(unlink(realPath))
      //     } else {
      //       this.warn(`Skip to uninstall unmanaged mod file on ${resource.path}!`)
      //     }
      //   } else {
      //     this.warn(`Skip to uninstall unmanaged mod file on ${resource.path}!`)
      //   }
      // } else {
      promises.push(unlink(resource.path).catch(e => {
        // if (e.code === 'ENOENT') {
        //   // Force remove
        //   this.state.instanceModRemove([resource])
        // }
      }))
      // }
    }
    await Promise.all(promises)
    this.log(`Finish to uninstall ${mods.length} from ${path}`)
  }
}
