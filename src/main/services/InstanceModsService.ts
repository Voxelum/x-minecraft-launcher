import { FabricModMetadata } from '@xmcl/mod-parser'
import { ensureDir, FSWatcher, stat, unlink } from 'fs-extra'
import watch from 'node-watch'
import { dirname, join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { AggregateExecutor } from '../util/aggregator'
import DiagnoseService from './DiagnoseService'
import InstanceService from './InstanceService'
import ResourceService from './ResourceService'
import { ExportService, Inject, Singleton, StatefulService, Subscribe } from './Service'
import { linkWithTimeoutOrCopy, readdirIfPresent } from '/@main/util/fs'
import { IssueReport } from '/@shared/entities/issue'
import { ForgeModCommonMetadata } from '/@shared/entities/mod'
import { AnyResource, FabricResource, isModResource, isPersistedResource } from '/@shared/entities/resource'
import { ResourceDomain } from '/@shared/entities/resource.schema'
import { InstallModsOptions, InstanceModsService as IInstanceModsService, InstanceModsServiceKey, InstanceModsState } from '/@shared/services/InstanceModsService'
import { parseVersion, VersionRange } from '/@shared/util/mavenVersion'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
@ExportService(InstanceModsServiceKey)
export default class InstanceModsService extends StatefulService<InstanceModsState> implements IInstanceModsService {
  private modsWatcher: FSWatcher | undefined

  private addMod = new AggregateExecutor<AnyResource, AnyResource[]>(v => v,
    res => this.state.instanceModAdd(res),
    1000)

  private removeMod = new AggregateExecutor<AnyResource, AnyResource[]>(v => v,
    res => this.state.instanceModRemove(res),
    1000)

  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app)
  }

  createState() { return new InstanceModsState() }

  private async scanMods(dir: string) {
    const files = await readdirIfPresent(dir)

    const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
      path: join(dir, file),
      url: [] as string[],
      source: undefined,
    }))
    const resources = await this.resourceService.resolveFiles({
      files: fileArgs,
      type: 'mods',
    })
    for (const [res, icon] of resources.filter(r => !isPersistedResource(r[0]))) {
      this.resourceService.importParsedResource({ path: res.path, type: res.type }, res, icon)
    }
    return resources.map(([res]) => res)
  }

  @Subscribe('instanceSelect')
  protected onInstance() {
    this.refresh()
  }

  @Subscribe('instanceMods', 'instanceModAdd', 'instanceModRemove')
  async onInstanceModsLoad() {
    await this.diagnoseMods()
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
      if (typeof mods === 'undefined') {
        this.warn(`The instance mods folder is undefined ${this.instanceService.state.path}!`)
        return
      }

      const mcversion = version.minecraft
      const resolvedMcVersion = parseVersion(mcversion)
      const pattern = /^\[.+\]$/

      const tree: Pick<IssueReport, 'unknownMod' | 'incompatibleMod' | 'requireForge' | 'requireFabric' | 'requireFabricAPI'> = {
        unknownMod: [],
        incompatibleMod: [],
        requireForge: [],
        requireFabric: [],
        requireFabricAPI: [],
      }
      const forgeMods = mods.filter(m => !!m && m.type === 'forge')
      for (const mod of forgeMods) {
        const meta = mod.metadata as ForgeModCommonMetadata
        const acceptVersion = meta.acceptMinecraft
        if (!acceptVersion) {
          tree.unknownMod.push({ name: mod.name, actual: mcversion })
          continue
        }
        const range = VersionRange.createFromVersionSpec(acceptVersion)
        if (range && !range.containsVersion(resolvedMcVersion)) {
          tree.incompatibleMod.push({ name: mod.name, accepted: acceptVersion, actual: mcversion })
        }
      }
      if (forgeMods.length > 0) {
        if (!version.forge) {
          tree.requireForge.push({})
        }
      }

      const fabricMods = mods.filter(m => m.type === 'fabric') as FabricResource[]
      if (fabricMods.length > 0) {
        if (!version.fabricLoader) {
          tree.requireFabric.push({})
        }
        for (const mod of fabricMods) {
          const fabMetadata = mod.metadata as FabricModMetadata
          if (fabMetadata.depends) {
            const fabApiVer = (fabMetadata.depends as any).fabric
            if (fabApiVer && !fabricMods.some(m => m.metadata.id === 'fabric')) {
              tree.requireFabricAPI.push({ version: fabApiVer, name: mod.name })
            }
          }
        }
      }

      Object.assign(report, tree)
      this.diagnoseService.report(report)
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
        this.resourceService.resolveFile({ path: filePath, type: 'mods' }).then(([resource, icon]) => {
          if (isModResource(resource)) {
            this.log(`Instace mod add ${filePath}`)
          } else {
            this.warn(`Non mod resource added in /mods directory! ${filePath}`)
          }
          if (!isPersistedResource(resource)) {
            this.resourceService.importParsedResource({ path: filePath }, resource, icon).catch((e) => {
              this.warn(e)
            })
            this.log(`Found new resource in /mods directory! ${filePath}`)
          }
          this.addMod.push(resource)
        })
      } else {
        const target = this.state.mods.find(r => r.path === filePath)
        if (target) {
          this.log(`Instace mod remove ${filePath}`)
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
    this.log(`Install ${resources.length} to ${path}`)
    for (const res of resources) {
      if (res.domain !== ResourceDomain.Mods) {
        this.warn(`Install non mod resource ${res.name} as it's not a mod`)
      }
      const src = join(res.path)
      const dest = join(path, ResourceDomain.Mods, res.fileName + res.ext)
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
    const root = join(path, ResourceDomain.Mods)
    for (const resource of mods) {
      if (dirname(resource.path) !== root) {
        const founded = this.state.mods.find(m => m.ino === resource.ino) ??
          this.state.mods.find(m => m.hash === resource.hash)
        if (founded) {
          promises.push(unlink(founded.path))
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
