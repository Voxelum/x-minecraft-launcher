import { InstanceShaderPacksService as IInstanceShaderPacksServic, InstanceShaderPacksServiceKey, LockKey, ResourceDomain } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey, PathResolver, kGameDataPath } from '~/app'
import { InstanceService } from '~/instance'
import { ResourceService } from '~/resource'
import { ExposeServiceKey, Lock } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDoaminService } from './AbstractInstanceDoaminService'

@ExposeServiceKey(InstanceShaderPacksServiceKey)
export class InstanceShaderPacksService extends AbstractInstanceDoaminService implements IInstanceShaderPacksServic {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ResourceService) protected resourceService: ResourceService,
    @Inject(kGameDataPath) protected getPath: PathResolver,
    @Inject(InstanceService) protected instanceService: InstanceService,
  ) {
    super(app)
  }

  domain = ResourceDomain.ShaderPacks

  @Lock(p => LockKey.shaderpacks(p))
  override scan(instancePath: string) {
    return super.scan(instancePath)
  }

  @Lock(p => LockKey.shaderpacks(p))
  override link(instancePath: string, force?: boolean) {
    return super.link(instancePath, force)
  }
}
