import { InstanceDataPacksService as IInstanceDataPacksService, InstanceDataPacksServiceKey } from '@xmcl/runtime-api'
import { Inject, LauncherAppKey } from '~/app'
import { ExposeServiceKey } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { AbstractInstanceDomainService } from './AbstractInstanceDomainService'

/**
 * Provide the abilities to import data pack and data packs files to instance
 */
@ExposeServiceKey(InstanceDataPacksServiceKey)
export class InstanceDataPacksService extends AbstractInstanceDomainService implements IInstanceDataPacksService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, 'datapacks')
  }
}
