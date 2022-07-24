import { PackMeta } from '@xmcl/resourcepack'
import { InstanceResourcePacksService as IInstanceResourcePacksService, InstanceResourcePacksServiceKey, isPersistedResource, isResourcePackResource, IssueReport, packFormatVersionRange, parseVersion, ResourceDomain, VersionRange } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { ensureDir, lstat, move, readdir, readlink, remove, unlink } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { isSystemError } from '../util/error'
import { createSymbolicLink, ENOENT_ERROR, linkWithTimeoutOrCopy } from '../util/fs'
import { DiagnoseService } from './DiagnoseService'
import { InstanceOptionsService } from './InstanceOptionsService'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { AbstractService, Inject, Singleton } from './Service'

/**
 * Provide the abilities to import resource pack and resource packs files to instance
 */
export class InstanceResourcePackService extends AbstractService implements IInstanceResourcePacksService {
  private packVersionToVersionRange: Record<number, string> = packFormatVersionRange

  private active: string | undefined

  constructor(
    app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceOptionsService) private gameSettingService: InstanceOptionsService,
    @Inject(DiagnoseService) private diagnoseService: DiagnoseService,
  ) {
    super(app, InstanceResourcePacksServiceKey)
    this.storeManager.subscribe('instanceGameSettingsLoad', (payload) => {
      if (payload.resourcePacks && this.active && !this.instanceService.isUnderManaged(this.active)) {
        for (const pack of payload.resourcePacks.filter(v => v !== 'vanilla')) {
          const fileName = pack.startsWith('file/') ? pack.substring('file/'.length) : pack
          const existedResource = this.resourceService.state.resourcepacks.find(f => fileName === f.fileName)
          const localFilePath = join(this.active, fileName)
          if (!existsSync(localFilePath)) {
            if (existedResource) {
              linkWithTimeoutOrCopy(existedResource.path, localFilePath)
            }
          }
        }
      }
    }).subscribe('instanceSelect', (instancePath) => {
      this.link(instancePath).catch((e) => {
        // TODO: decorate error
        this.emit('error', {})
      })
    }).subscribe('instanceGameSettingsLoad', async (payload) => {
      if ('resourcePacks' in payload) {
        await this.diagnoseResourcePacks()
      }
    })

    // this.storeManager.subscribe('resource', (r) => {
    //   if (!this.active) return
    //   const existed = this.activeResourcePacks.find(p => p.hash === r.hash)
    //   if (!existed) {
    //     linkWithTimeoutOrCopy(r.path, join(this.active, basename(r.path)))
    //   }
    // })
    // this.storeManager.subscribe('resources', (rs) => {
    //   if (!this.active) return
    //   for (const r of rs) {
    //     const existed = this.activeResourcePacks.find(p => p.hash === r.hash)
    //     if (!existed) {
    //       linkWithTimeoutOrCopy(r.path, join(this.active, basename(r.path)))
    //     } else {
    //       if (basename(existed.path, r.ext) !== r.fileName) {
    //         rename(existed.path, join(dirname(existed.path), r.fileName + r.ext))
    //       }
    //     }
    //   }
    // })
    // this.storeManager.subscribe('resourcesRemove', (rs) => {
    //   if (!this.active) return
    //   for (const r of rs) {
    //     const existed = this.activeResourcePacks.find(p => p.hash === r.hash)
    //     if (existed) {
    //       unlink(existed.path)
    //     }
    //   }
    // })
  }

  // private watcher: FSWatcher | undefined
  // private activeResourcePacks: AnyPersistedResource[] = []

  @Singleton()
  async diagnoseResourcePacks() {
    // this.up('diagnose')
    // try {
    //   const report: Partial<IssueReport> = {}
    //   this.log('Diagnose resource packs')
    //   const { runtime: version } = this.instanceService.state.instance
    //   const resourcePacks = this.gameSettingService.state.options.resourcePacks
    //   const resources = resourcePacks.map((name) => this.resourceService.state.resourcepacks.find((pack) => `file/${pack.name}${pack.ext}` === name))

    //   const mcversion = version.minecraft
    //   const resolvedMcVersion = parseVersion(mcversion)

    //   const tree: Pick<IssueReport, 'incompatibleResourcePack'> = {
    //     incompatibleResourcePack: [],
    //   }

    //   const packFormatMapping = this.packVersionToVersionRange
    //   for (const pack of resources) {
    //     if (!pack) continue
    //     const metadata = pack.metadata as PackMeta.Pack
    //     if (metadata.pack_format in packFormatMapping) {
    //       const acceptVersion = packFormatMapping[metadata.pack_format]
    //       const range = VersionRange.createFromVersionSpec(acceptVersion)
    //       if (range && !range.containsVersion(resolvedMcVersion)) {
    //         tree.incompatibleResourcePack.push({ name: pack.name, accepted: acceptVersion, actual: mcversion })
    //       }
    //     }
    //   }

    //   Object.assign(report, tree)
    //   this.diagnoseService.report(report)
    // } finally {
    //   this.down('diagnose')
    // }
  }

  // async dispose(): Promise<void> {
  //   this.watcher?.close()
  //   this.active = undefined
  //   this.activeResourcePacks = []
  // }

  // private async watchUnmanagedInstance(path: string) {
  //   this.watcher = watch(path, (event, name) => {
  //     if (name.startsWith('.')) return
  //     const filePath = name
  //     if (event === 'update') {
  //       this.resourceService.resolveResource({ path: filePath, type: 'resourcepack' }).then(([resource, icon]) => {
  //         if (isResourcePackResource(resource)) {
  //           this.log(`Instance resourcepack add ${filePath}`)
  //         } else {
  //           this.warn(`Non resourcepack resource added in /resourcepacks directory! ${filePath}`)
  //         }
  //         if (resource.fileType === 'directory') {
  //           // ignore directory
  //           return
  //         }
  //         if (!isPersistedResource(resource)) {
  //           if (resource.fileType !== 'directory' && resource.type === ResourceType.Unknown) {
  //             this.log(`Skip to import unknown directory to /resourcepacks! ${filePath}`)
  //             return
  //           }
  //           this.resourceService.importParsedResource({ path: filePath }, resource, icon).then((res) => {
  //             this.activeResourcePacks.push({ ...res, path: resource.path })
  //           }, (e) => {
  //             this.activeResourcePacks.push(resource)
  //             this.warn(`Fail to persist resource in /resourcepacks directory! ${filePath}`)
  //             this.warn(e)
  //           })
  //           this.log(`Found new resource in /resourcepacks directory! ${filePath}`)
  //         } else {
  //           this.activeResourcePacks.push(resource)
  //         }
  //       })
  //     } else {
  //       const target = this.activeResourcePacks.find(r => r.path === filePath)
  //       if (target) {
  //         this.log(`Instance resourcepack remove ${filePath}`)
  //         const i = this.activeResourcePacks.findIndex(r => r.hash === target.hash)
  //         this.activeResourcePacks.splice(i, 1)
  //       } else {
  //         this.warn(`Cannot remove the resourcepack ${filePath} as it's not found in memory cache!`)
  //       }
  //     }
  //   })
  // }

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
    this.active = destPath
    await this.resourceService.whenReady(ResourceDomain.ResourcePacks)
    await this.dispose()
    const importAllResources = async () => {
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
          // if (newRes) {
          //   this.activeResourcePacks.push(newRes)
          // }
        } else {
          // this.activeResourcePacks.push(resource)
        }
      }))
    }
    this.log(`Linking the resourcepacks at domain to ${instancePath}`)
    if (stat) {
      if (stat.isSymbolicLink()) {
        if (await readlink(destPath) === srcPath) {
          this.log(`Skip linking the resourcepacks at domain as it already linked: ${instancePath}`)
        } else {
          this.log(`Relink the resourcepacks domain: ${instancePath}`)
          await unlink(destPath)
        }
      } else {
        // Import all directory content
        if (stat.isDirectory()) {
          await importAllResources()
          if (!this.instanceService.isUnderManaged(instancePath)) {
            // do not link if this is not an managed instance
            // await this.watchUnmanagedInstance(destPath)
            return
          } else {
            await remove(destPath)
          }
        } else {
          await move(destPath, `${destPath}_backup`)
        }
      }
    } else if (!this.instanceService.isUnderManaged(instancePath)) {
      // do not link if this is not an managed instance
      // await this.watchUnmanagedInstance(destPath)
      await ensureDir(destPath)
      return
    }
    await createSymbolicLink(srcPath, destPath)
  }

  async showDirectory(): Promise<void> {
    await this.app.openDirectory(join(this.instanceService.state.path, 'resourcepacks'))
  }
}
