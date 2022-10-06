import { InstanceUpdateService as IInstanceUpdateService, InstanceUpdateServiceKey } from '@xmcl/runtime-api'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { Inject } from '../util/objectRegistry'
import { ExposeServiceKey, AbstractService } from './Service'

@ExposeServiceKey(InstanceUpdateServiceKey)
export class InstanceUpdateService extends AbstractService implements IInstanceUpdateService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp) {
    super(app, InstanceUpdateServiceKey)
  }
}
