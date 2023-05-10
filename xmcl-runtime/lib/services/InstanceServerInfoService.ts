import { InstanceServerInfoService as IInstanceServerInfoService, InstanceServerInfoServiceKey, ServerInfoState } from '@xmcl/runtime-api'
import { readFile } from 'fs/promises'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { exists } from '../util/fs'
import { Inject } from '../util/objectRegistry'
import { AbstractService, ExposeServiceKey } from './Service'

@ExposeServiceKey(InstanceServerInfoServiceKey)
export class InstanceServerInfoService extends AbstractService implements IInstanceServerInfoService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
  ) {
    super(app)
  }

  async watch(path: string) {
    const state = this.storeManager.register('InstanceServerInfo/' + path, new ServerInfoState())

    const serversPath = join(path, 'servers.dat')
    if (await exists(serversPath)) {
      const serverDat = await readFile(serversPath)
      const infos = /* await readInfo(serverDat) */ undefined as any
      this.log('Loaded server infos.')
      state.instanceServerInfos(infos)
    } else {
      this.log('No server data found in instance.')
    }

    return state
  }
}
