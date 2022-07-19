import { AnyResource, getFabricModCompatibility, InstallModsOptions, InstanceModsService as IInstanceModsService, InstanceModsServiceKey, InstanceModsState, isFabricResource, isForgeResource, isModResource, isPersistedResource, IssueReport, IssueReportBuilder, RequireFabricAPIIssueKey, RequireFabricIssueKey, RequireForgeIssueKey, ResourceDomain, ResourceType } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { ensureDir, FSWatcher, stat, unlink } from 'fs-extra'
import watch from 'node-watch'
import { dirname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { AggregateExecutor } from '../util/aggregator'
import { linkWithTimeoutOrCopy, readdirIfPresent } from '../util/fs'
import { DiagnoseService } from './DiagnoseService'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { Inject, Singleton, StatefulService } from './Service'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
export class InstanceModsService extends StatefulService<InstanceModsState> implements IInstanceModsService {
  private modsWatcher: FSWatcher | undefined

  private addMod = new AggregateExecutor<AnyResource, AnyResource[]>(v => v,
    res => this.state.instanceModUpdate(res),
    0)

  private removeMod = new AggregateExecutor<AnyResource, AnyResource[]>(v => v,
    res => this.state.instanceModRemove(res),
    0)

  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app, InstanceModsServiceKey, () => new InstanceModsState())
    this.storeManager.subscribe('resources', (resources) => {
      this.state.instanceModUpdateExisted(resources)
    }).subscribe('resource', (r) => {
      this.state.instanceModUpdateExisted([r])
    }).subscribeAll(['instanceMods', 'instanceModUpdate', 'instanceModRemove', 'instanceEdit', 'localVersionAdd', 'localVersionRemove', 'localVersions'], async () => {
      // await this.diagnoseMods()
    }).subscribe('instanceSelect', () => {
      this.refresh()
    })
  }

  async showDirectory(): Promise<void> {
    await this.app.openDirectory(join(this.instanceService.state.path, 'mods'))
  }

  private async scanMods(dir: string) {
    const files = await readdirIfPresent(dir)

    const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
      path: join(dir, file),
      url: [] as string[],
      source: undefined,
    }))
    const resources = await this.resourceService.resolveResources({
      files: fileArgs,
      type: 'mods',
    })
    const persisted = await Promise.all(resources
      .filter(([res]) => res.fileType !== 'directory') // not show dictionary
      .map(async ([res, icon]) => !isPersistedResource(res) ? { ...(await this.resourceService.importParsedResource({ path: res.path, type: res.type }, res, icon)), path: res.path } : Promise.resolve(res)))
    return persisted
  }

  async dispose() {
    if (this.modsWatcher) {
      this.modsWatcher.close()
    }
  }

  @Singleton()
  async diagnoseMods() {
    this.up('diagnose')
    try {
      const report: Partial<IssueReport> = {}
      const { runtime: version } = this.instanceService.state.instance
      this.log(`Diagnose mods under ${version.minecraft}`)
      const mods = this.state.mods

      const mcVersion = version.minecraft

      const builder = new IssueReportBuilder()

      builder.set(RequireForgeIssueKey)
      builder.set(RequireFabricIssueKey)
      builder.set(RequireFabricAPIIssueKey)

      const forgeMods = mods.filter(isForgeResource)
      const fabricMods = mods.filter(isFabricResource)

      if (forgeMods.length > 0 && fabricMods.length > 0) {
        // forge fabric conflict
        // tree.loaderConflict.push({ loaders: ['forge', 'fabric'] })
      } else if (forgeMods.length > 0) {
        if (!version.forge) {
          // no forge
          builder.set(RequireForgeIssueKey, {})
        } else {
          // for (const mod of forgeMods) {
          //   const forgeComp = getForgeModCompatibility(mod, version)
          //   for (const [modid, comp] of Object.entries(forgeComp)) {
          //     for (const [depName, detail] of Object.entries(comp)) {
          //       if (!detail.compatible) {
          //         tree.incompatibleMod.push({ name: mod.name, accepted: detail.requirements, actual: detail.version, dep: depName })
          //       }
          //     }
          //   }
          // }
        }
      } else if (fabricMods.length > 0) {
        if (!version.fabricLoader) {
          // no fabric
          builder.set(RequireFabricIssueKey, {})
        } else {
          for (const mod of fabricMods) {
            const comp = getFabricModCompatibility(mod, version)
            // for (const [depName, detail] of Object.entries(comp)) {
            //   if (!detail.compatible) {
            //     tree.incompatibleMod.push({ name: mod.name, accepted: detail.requirements, actual: detail.version, dep: depName })
            //   }
            // }
            if (comp.fabric && !comp.fabric.compatible) {
              // fabric api not compatible
              builder.set(RequireFabricAPIIssueKey, { version: comp.fabric.version, name: mod.name })
            }
          }
        }
      }

      this.diagnoseService.report(builder.build())
    } finally {
      this.down('diagnose')
    }
  }

  async refresh(force?: boolean): Promise<void> {
    const basePath = this.instanceService.state.path
    if (force || this.state.instance !== basePath || !this.modsWatcher) {
      await this.mount(basePath)
    }
  }

  @Singleton()
  async mount(instancePath: string): Promise<void> {
    const basePath = join(instancePath, 'mods')
    if (this.modsWatcher) {
      this.modsWatcher.close()
    }
    await ensureDir(basePath)
    await this.resourceService.whenReady(ResourceDomain.Mods)
    this.state.instanceMods({ instance: instancePath, resources: await this.scanMods(basePath) })
    this.modsWatcher = watch(basePath, (event, name) => {
      if (name.startsWith('.')) return
      const filePath = name
      if (event === 'update') {
        this.resourceService.resolveResource({ path: filePath, type: 'mods' }).then(([resource, icon]) => {
          if (isModResource(resource)) {
            this.log(`Instance mod add ${filePath}`)
          } else {
            this.warn(`Non mod resource added in /mods directory! ${filePath}`)
          }
          if (resource.fileType === 'directory') {
            // ignore directory
            return
          }
          if (!isPersistedResource(resource)) {
            this.resourceService.importParsedResource({ path: filePath, restrictToDomain: ResourceDomain.Mods }, resource, icon).then((res) => {
              this.addMod.push({ ...res, path: resource.path })
            }, (e) => {
              this.addMod.push(resource)
              this.warn(`Fail to persist resource in /mods directory! ${filePath}`)
              this.warn(e)
            })
            this.log(`Found new resource in /mods directory! ${filePath}`)
          } else {
            this.addMod.push(resource)
          }
        })
      } else {
        const target = this.state.mods.find(r => r.path === filePath)
        if (target) {
          this.log(`Instance mod remove ${filePath}`)
          this.removeMod.push(target)
        } else {
          this.warn(`Cannot remove the mod ${filePath} as it's not found in memory cache!`)
        }
      }
    })
    this.log(`Mounted on instance mods: ${basePath}`)
  }

  async install({ mods: resources, path = this.state.instance }: InstallModsOptions) {
    const promises: Promise<void>[] = []
    if (!path) {
      path = this.state.instance
    }
    this.log(`Install ${resources.length} to ${path}/mods`)
    for (const res of resources) {
      if (res.domain !== ResourceDomain.Mods) {
        this.warn(`Install non mod resource ${res.name} as it's not a mod`)
      }
      const src = join(res.path)
      const dest = join(path, ResourceDomain.Mods, res.fileName)
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest).catch(() => undefined)])

      let promise: Promise<void> | undefined
      if (!destStat) {
        promise = linkWithTimeoutOrCopy(src, dest)
      } else if (srcStat.ino !== destStat.ino) {
        promise = unlink(dest).then(() => linkWithTimeoutOrCopy(src, dest))
      }
      if (promise) {
        promises.push(promise.catch((e) => {
          this.error(`Cannot deploy the resource from ${src} to ${dest}`)
          this.error(e)
          throw e
        }))
      }
    }
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  async uninstall(options: InstallModsOptions) {
    const { mods, path = this.state.instance } = options
    this.log(`Uninstall ${mods.length} mods from ${path}`)
    const promises: Promise<void>[] = []
    const instanceModsDir = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      if (dirname(resource.path) !== instanceModsDir) {
        const founded = this.state.mods.find(m => m.ino === resource.ino) ??
          this.state.mods.find(m => m.hash === resource.hash)
        if (founded && founded.path !== resource.path) {
          const realPath = join(instanceModsDir, founded.fileName)
          if (existsSync(realPath)) {
            promises.push(unlink(realPath))
          } else {
            this.warn(`Skip to uninstall unmanaged mod file on ${resource.path}!`)
          }
        } else {
          this.warn(`Skip to uninstall unmanaged mod file on ${resource.path}!`)
        }
      } else {
        promises.push(unlink(resource.path))
      }
    }
    await Promise.all(promises)
    this.log(`Finish to uninstall ${mods.length} from ${path}`)
  }
}
