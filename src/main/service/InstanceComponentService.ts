import { ResolvedVersion } from '@xmcl/core'
import LauncherApp from '../app/LauncherApp'
import AbstractService, { Subscribe } from './Service'

export default class InstanceComponentService extends AbstractService {
  constructor(app: LauncherApp) {
    super(app)
  }
}
