import { PackMeta } from '@xmcl/resourcepack'
import { InstanceResourcePacksService as IInstanceResourcePacksService, InstanceResourcePacksServiceKey, isPersistedResource, isResourcePackResource, IssueReport, packFormatVersionRange, parseVersion, ResourceDomain, VersionRange } from '@xmcl/runtime-api'
import { lstat, readdir, readlink, remove, symlink, unlink } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { isSystemError } from '../util/error'
import { ENOENT_ERROR } from '../util/fs'
import DiagnoseService from './DiagnoseService'
import InstanceOptionsService from './InstanceOptionsService'
import InstanceService from './InstanceService'
import ResourceService from './ResourceService'
import AbstractService, { ExportService, Inject, Singleton, Subscribe } from './Service'

/**
 * Provide the abilities to import mods and resource packs files to instance
 */
@ExportService(InstanceResourcePacksServiceKey)
export default class InstanceResourcePackService extends AbstractService implements IInstanceResourcePacksService {
  private packVersionToVersionRange: Record<number, string> = packFormatVersionRange

  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceOptionsService) private gameSettingService: InstanceOptionsService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app)
  }

  @Subscribe('instanceSelect')
  protected onInstance(instancePath: string) {
    this.link(instancePath).catch((e) => [
      // TODO: decorate error
      this.emit('error', {}),
    ])
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
      const resourcePacks = this.gameSettingService.state.options.resourcePacks
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

  @Singleton()
  async link(instancePath: string = this.instanceService.state.path): Promise<void> {
    await this.resourceService.whenReady(ResourceDomain.ResourcePacks)
    const destPath = join(instancePath, 'resourcepacks')
    const srcPath = this.getPath('resourcepacks')
    const stat = await lstat(destPath).catch((e) => {
      if (isSystemError(e) && e.code === ENOENT_ERROR) {
        return
      }
      throw e
    })

    await this.resourceService.whenReady(ResourceDomain.ResourcePacks)
    this.log(`Linking the resourcepacks at domain to ${instancePath}`)
    if (stat) {
      if (stat.isSymbolicLink()) {
        if (await readlink(destPath) === srcPath) {
          this.log(`Skip linking the resourcepacks at domain as it already linked: ${instancePath}`)
          return
        }
        this.log(`Relink the resourcepacks domain: ${instancePath}`)
        await unlink(destPath)
      } else {
        // Import all directory content
        if (stat.isDirectory()) {
          const files = await readdir(destPath)

          this.log(`Import resourcepacks directories while linking: ${instancePath}`)
          await Promise.all(files.map(f => join(destPath, f)).map(async (filePath) => {
            const [resource, icon] = await this.resourceService.resolveResource({ path: filePath, type: 'resourcepacks' })
            if (isResourcePackResource(resource)) {
              this.log(`Add resource pack ${filePath}`)
            } else {
              this.warn(`Non resource pack resource added in /resourcepacks directory! ${filePath}`)
            }
            if (!isPersistedResource(resource)) {
              await this.resourceService.importParsedResource({ path: filePath }, resource, icon).catch((e) => {
                this.emit('error', {})
                this.warn(e)
              })
              this.log(`Found new resource in /resourcepacks directory! ${filePath}`)
            }
          }))

          await remove(destPath)
        } else {
          // TODO: handle this case
          throw new Error()
        }
      }
    }

    await symlink(srcPath, destPath, 'dir')
  }

  async showDirectory(): Promise<void> {
    await this.app.openDirectory(join(this.instanceService.state.path, 'resourcepacks'))
  }
}
