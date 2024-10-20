import { InstanceShaderPacksService as IInstanceShaderPacksServic, InstanceShaderPacksServiceKey, LockKey, ResourceDomain } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceManager } from '~/resource'
import { ExposeServiceKey, Lock, ServiceStateManager } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDomainService } from './AbstractInstanceDoaminService'

@ExposeServiceKey(InstanceShaderPacksServiceKey)
export class InstanceShaderPacksService extends AbstractInstanceDomainService implements IInstanceShaderPacksServic {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceManager) protected resourceManager: ResourceManager,
    @Inject(kGameDataPath) protected getPath: PathResolver,
    @Inject(InstanceService) protected instanceService: InstanceService,
    @Inject(ServiceStateManager) protected store: ServiceStateManager,
  ) {
    super(app)
  }

  domain = ResourceDomain.ShaderPacks

  @Lock(p => LockKey.shaderpacks(p))
  override link(instancePath: string, force?: boolean) {
    return super.link(instancePath, force)
  }
}
