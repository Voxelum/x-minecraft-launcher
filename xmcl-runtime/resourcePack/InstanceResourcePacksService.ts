import { InstanceResourcePacksService as IInstanceResourcePacksService, InstanceResourcePacksServiceKey, LockKey, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { existsSync } from 'fs'
import { readdir, stat } from 'fs-extra'
import { basename, join } from 'path'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceService } from '~/resource'
import { AbstractService, ExposeServiceKey, Lock } from '~/service'
import { AnyError } from '~/util/error'
import { LauncherApp } from '../app/LauncherApp'
import { linkWithTimeoutOrCopy } from '../util/fs'
import { tryLink } from '../util/linkResourceFolder'

/**
 * Provide the abilities to import resource pack and resource packs files to instance
 */
@ExposeServiceKey(InstanceResourcePacksServiceKey)
export class InstanceResourcePackService extends AbstractService implements IInstanceResourcePacksService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(InstanceService) private instanceService: InstanceService,
  ) {
    super(app)
  }

  async install(instancePath: string, resourcePack: string) {
    const fileName = basename(resourcePack)
    const src = this.getPath(ResourceDomain.ResourcePacks, fileName)
    const dest = join(instancePath, ResourceDomain.ResourcePacks, fileName)
    if (!existsSync(dest)) {
      throw Object.assign(new Error(), { name: 'FileNotFound' })
    }
    const fstat = await stat(src)
    if (fstat.isDirectory()) return
    await linkWithTimeoutOrCopy(src, dest)
  }

  @Lock(p => LockKey.resourcepacks(p))
  async scan(instancePath: string): Promise<Resource[]> {
    const destPath = join(instancePath, 'resourcepacks')
    const files = await readdir(destPath).catch(() => [])

    this.log(`Import resourcepacks directories while linking: ${instancePath}`)
    const resources = await this.resourceService.importResources(files.map(f => ({ path: join(destPath, f), domain: ResourceDomain.ResourcePacks })))
    this.log(`Import ${resources.length} resourcepacks.`)

    return resources
  }

  @Lock(p => LockKey.resourcepacks(p))
  async link(instancePath: string): Promise<boolean> {
    if (!instancePath) return false
    await this.resourceService.whenReady(ResourceDomain.ResourcePacks)
    const destPath = join(instancePath, 'resourcepacks')
    const srcPath = this.getPath('resourcepacks')
    try {
      const isLinked = await tryLink(srcPath, destPath, this, (path) => this.instanceService.isUnderManaged(path))
      return isLinked
    } catch (e) {
      this.error(new AnyError('LinkResourcePacksError', `Fail to link resourcepacks folder under: "${instancePath}"`, { cause: e }))
      return false
    }
  }

  async showDirectory(path: string): Promise<void> {
    await this.app.shell.openDirectory(join(path, 'resourcepacks'))
  }
}
