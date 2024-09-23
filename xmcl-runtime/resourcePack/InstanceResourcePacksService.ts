import { InstanceResourcePacksService as IInstanceResourcePacksService, InstanceResourcePacksServiceKey, LockKey, Resource, ResourceDomain } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceService } from '~/resource'
import { ExposeServiceKey, Lock } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDoaminService } from './AbstractInstanceDoaminService'

/**
 * Provide the abilities to import resource pack and resource packs files to instance
 */
@ExposeServiceKey(InstanceResourcePacksServiceKey)
export class InstanceResourcePackService extends AbstractInstanceDoaminService implements IInstanceResourcePacksService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) protected resourceService: ResourceService,
    @Inject(kGameDataPath) protected getPath: PathResolver,
    @Inject(InstanceService) protected instanceService: InstanceService,
  ) {
    super(app)
  }

  domain = ResourceDomain.ResourcePacks

  override scan(instancePath: string): Promise<Resource[]> {
    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))
    return lock.read(() => super.scan(instancePath))
  }

  override link(instancePath: string, force?: boolean): Promise<boolean> {
    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))
    return lock.read(() => super.link(instancePath, force))
  }
}
