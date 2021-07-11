import { PackMeta } from '@xmcl/resourcepack'
import { ensureDir, FSWatcher, stat, unlink } from 'fs-extra'
import watch from 'node-watch'
import { dirname, join } from 'path'
import { InstallResourcePacksOptions, InstanceResourcePacksService as IInstanceResourcePacksService, InstanceResourcePacksServiceKey, InstanceResourcePacksState } from '../../shared/services/InstanceResourcePacksService'
import LauncherApp from '../app/LauncherApp'
import { AggregateExecutor } from '../util/aggregator'
import DiagnoseService from './DiagnoseService'
import InstanceGameSettingService from './InstanceGameSettingService'
import InstanceService from './InstanceService'
import ResourceService from './ResourceService'
import { ExportService, Inject, Singleton, StatefulService, Subscribe } from './Service'
import { linkWithTimeoutOrCopy, readdirIfPresent } from '/@main/util/fs'
import { IssueReport } from '/@shared/entities/issue'
import { AnyResource, isPersistedResource, isResourcePackResource } from '/@shared/entities/resource'
import { ResourceDomain } from '/@shared/entities/resource.schema'
import { parseVersion, VersionRange } from '/@shared/util/mavenVersion'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
@ExportService(InstanceResourcePacksServiceKey)
export default class InstanceResourcePackService extends StatefulService<InstanceResourcePacksState> implements IInstanceResourcePacksService {
  private resourcepacksWatcher: FSWatcher | undefined

  private addResourcePack = new AggregateExecutor<AnyResource, AnyResource[]>(v => v,
    res => this.state.instanceResourcepackAdd(res),
    1000)

  private removeResourcePack = new AggregateExecutor<AnyResource, AnyResource[]>(v => v,
    res => this.state.instanceResourcepackRemove(res),
    1000)

  private packVersionToVersionRange: Record<number, string> = Object.freeze({
    1: '[1.6, 1.9)',
    2: '[1.9, 1.11)',
    3: '[1.11, 1.13)',
    4: '[1.13,]',
  })

  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceGameSettingService) private gameSettingService: InstanceGameSettingService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app)
  }

  createState() { return new InstanceResourcePacksState() }

  private async scanResourcepacks(dir: string) {
    const files = await readdirIfPresent(dir)

    const fileArgs = files.filter((file) => !file.startsWith('.')).map((file) => ({
      path: join(dir, file),
      url: [] as string[],
      source: undefined,
    }))

    const resources = await this.resourceService.parseFiles({
      files: fileArgs,
      type: 'resourcepack',
    })

    // for (const [res, icon] of resources.filter(r => !isPersistedResource(r[0]))) {
    //   this.resourceService.importParsedResource({ path: res.path, type: res.type }, res, icon)
    // }
    return resources.map(([res]) => res)
  }

  @Subscribe('instanceSelect')
  protected onInstance() {
    this.refresh()
  }

  @Subscribe('instanceGameSettings')
  async onInstanceResourcepacksLaod(payload: any) {
    if ('resourcePacks' in payload) {
      await this.diagnoseResourcePacks()
    }
  }

  @Singleton()
  async diagnoseResourcePacks() {
    this.up('diagnose')
    try {
      const report: Partial<IssueReport> = {}
      this.log('Diagnose resource packs')
      const { runtime: version } = this.instanceService.state.instance
      const resourcePacks = this.gameSettingService.state.resourcePacks
      const resources = resourcePacks.map((name) => this.resourceService.state.resourcepacks.find((pack) => `file/${pack.name}${pack.ext}` === name))

      const mcversion = version.minecraft
      const resolvedMcVersion = parseVersion(mcversion)

      const tree: Pick<IssueReport, 'incompatibleResourcePack'> = {
        incompatibleResourcePack: [],
      }

      const packFormatMapping = this.packVersionToVersionRange
      for (const pack of resources) {
        if (!pack) continue
        const metadata = pack.metadata as PackMeta.Pack
        if (metadata.pack_format in packFormatMapping) {
          const acceptVersion = packFormatMapping[metadata.pack_format]
          const range = VersionRange.createFromVersionSpec(acceptVersion)
          if (range && !range.containsVersion(resolvedMcVersion)) {
            tree.incompatibleResourcePack.push({ name: pack.name, accepted: acceptVersion, actual: mcversion })
          }
        }
      }

      Object.assign(report, tree)
      this.diagnoseService.report(report)
    } finally {
      this.down('diagnose')
    }
  }

  async dispose() {
    if (this.resourcepacksWatcher) {
      this.resourcepacksWatcher.close()
    }
  }

  async refresh(force?: boolean): Promise<void> {
    const basePath = this.instanceService.state.path
    if (force || this.state.instance !== basePath || !this.resourcepacksWatcher) {
      await this.mount(basePath)
    }
  }

  @Singleton()
  async mount(instancePath: string): Promise<void> {
    const basePath = join(instancePath, 'resourcepacks')

    if (this.resourcepacksWatcher) {
      this.resourcepacksWatcher.close()
    }
    await ensureDir(basePath)
    await this.resourceService.whenResourcePacksReady()
    this.state.instanceResourcepacks({ instance: instancePath, resources: await this.scanResourcepacks(basePath) })
    this.resourcepacksWatcher = watch(basePath, (event, name) => {
      if (name.startsWith('.')) return
      const filePath = name
      if (event === 'update') {
        this.resourceService.parseFile({ path: filePath, type: 'resourcepacks' }).then(([resource, icon]) => {
          if (isResourcePackResource(resource)) {
            this.log(`Instace resource pack add ${filePath}`)
          } else {
            this.warn(`Non resource pack resource added in /resourcepacks directory! ${filePath}`)
          }
          if (!isPersistedResource(resource)) {
            this.resourceService.importParsedResource({ path: filePath }, resource, icon)
          }
          this.addResourcePack.push(resource)
        })
      } else {
        const target = this.state.resourcepacks.find(r => r.path === filePath)
        if (target) {
          this.log(`Instace resource pack remove ${filePath}`)
          this.removeResourcePack.push(target)
        } else {
          this.warn(`Cannot remove the resource pack ${filePath} as it's not found in memory cache!`)
        }
      }
    })
    this.log(`Mounted on instance resource packs: ${basePath}`)
  }

  async ensureResourcePacksDeployment() {
    const allPacks = this.resourceService.state.resourcepacks
    const deploiedPacks = this.state.resourcepacks

    const toBeDeploiedPacks = allPacks.filter(p => !deploiedPacks.find((r) => r.hash === p.hash))
    this.log(`Deploying ${toBeDeploiedPacks.length} resource packs`)

    await this.install({ resources: toBeDeploiedPacks })
  }

  async install({ resources, path = this.state.instance }: InstallResourcePacksOptions) {
    const promises: Promise<void>[] = []
    if (!path) {
      path = this.state.instance
    }
    this.log(`Install ${resources.length} resourcepacks to ${path}`)
    for (const res of resources) {
      if (res.domain !== ResourceDomain.ResourcePacks) {
        this.warn(`Install non resourcepack resource ${res.name}!`)
      }
      const src = join(res.path)
      const dest = join(path, ResourceDomain.ResourcePacks, res.fileName + res.ext)
      const [srcStat, destStat] = await Promise.all([stat(src), stat(dest).catch(() => undefined)])

      let promise: Promise<void> | undefined
      if (!destStat) {
        promise = linkWithTimeoutOrCopy(src, dest)
      } else if (srcStat.ino !== destStat.ino) {
        promise = unlink(dest).then(() => linkWithTimeoutOrCopy(src, dest))
      }
      if (promise) {
        promises.push(promise.catch((e) => {
          this.error(`Cannot install the resource from ${src} to ${dest}`)
          this.error(e)
          throw e
        }))
      }
    }
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  async uninstall(options: InstallResourcePacksOptions) {
    const { resources, path = this.state.instance } = options
    this.log(`Undeploy ${resources.length} from ${path}`)
    const promises: Promise<void>[] = []
    const root = join(path, ResourceDomain.ResourcePacks)
    for (const resource of resources) {
      if (dirname(resource.path) !== root) {
        this.warn(`Skip to uninstall unmanaged resourcepack file on ${resource.path}!`)
      } else {
        promises.push(unlink(resource.path))
      }
    }
    await Promise.all(promises)
  }
}
