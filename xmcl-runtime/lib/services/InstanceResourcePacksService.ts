import { InstanceResourcePacksService as IInstanceResourcePacksService, InstanceResourcePacksServiceKey, LockKey, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { basename, join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { tryLink } from '../util/linkResourceFolder'
import { Inject } from '../util/objectRegistry'
import { InstanceOptionsService } from './InstanceOptionsService'
import { InstanceService } from './InstanceService'
import { ResourceService } from './ResourceService'
import { AbstractService, ExposeServiceKey, Lock } from './Service'
import { readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { linkWithTimeoutOrCopy } from '../util/fs'
import { PathResolver, kGameDataPath } from '../entities/gameDataPath'

/**
 * Provide the abilities to import resource pack and resource packs files to instance
 */
@ExposeServiceKey(InstanceResourcePacksServiceKey)
export class InstanceResourcePackService extends AbstractService implements IInstanceResourcePacksService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) private resourceService: ResourceService,
    @Inject(kGameDataPath) private getPath: PathResolver,
    @Inject(InstanceService) private instanceService: InstanceService,
    @Inject(InstanceOptionsService) gameSettingService: InstanceOptionsService,
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
    await this.resourceService.whenReady(ResourceDomain.ResourcePacks)
    const destPath = join(instancePath, 'resourcepacks')
    const srcPath = this.getPath('resourcepacks')
    try {
      const isLinked = await tryLink(srcPath, destPath, this, (path) => this.instanceService.isUnderManaged(path))
      return isLinked
    } catch (e) {
      this.error(e as Error)
      return false
    }
  }

  async showDirectory(path: string): Promise<void> {
    await this.app.shell.openDirectory(join(path, 'resourcepacks'))
  }
}
