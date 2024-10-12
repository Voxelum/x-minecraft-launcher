import { InstanceResourcePacksService as IInstanceResourcePacksService, InstanceResourcePacksServiceKey, LockKey, ResourceDomain } from '@xmcl/runtime-api'
import { Inject, kGameDataPath, LauncherAppKey, PathResolver } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceManager } from '~/resource'
import { ExposeServiceKey, ServiceStateManager } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDomainService } from './AbstractInstanceDoaminService'

/**
 * Provide the abilities to import resource pack and resource packs files to instance
 */
@ExposeServiceKey(InstanceResourcePacksServiceKey)
export class InstanceResourcePackService extends AbstractInstanceDomainService implements IInstanceResourcePacksService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceManager) protected resourceManager: ResourceManager,
    @Inject(kGameDataPath) protected getPath: PathResolver,
    @Inject(InstanceService) protected instanceService: InstanceService,
    @Inject(ServiceStateManager) protected store: ServiceStateManager,
  ) {
    super(app)
  }

  domain = ResourceDomain.ResourcePacks

  override link(instancePath: string, force?: boolean): Promise<boolean> {
    const lock = this.semaphoreManager.getLock(LockKey.instance(instancePath))
    return lock.read(() => super.link(instancePath, force))
  }
}
