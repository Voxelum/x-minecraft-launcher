import { InstanceResourcePacksService as IInstanceResourcePacksService, InstanceResourcePacksServiceKey, ResourceDomain } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDomainService } from './AbstractInstanceDomainService'

/**
 * Provide the abilities to import resource pack and resource packs files to instance
 */
@ExposeServiceKey(InstanceResourcePacksServiceKey)
export class InstanceResourcePackService extends AbstractInstanceDomainService implements IInstanceResourcePacksService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, ResourceDomain.ResourcePacks)
  }
}
