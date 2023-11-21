import { InstanceServerInfoService as IInstanceServerInfoService, InstanceServerInfoServiceKey, ServerInfoState, getServerInfoKey } from '@xmcl/runtime-api'
import { readFile } from 'fs/promises'
import watch from 'node-watch'
import { join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
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
    return this.storeManager.registerOrGet(getServerInfoKey(path), async () => {
      const state = new ServerInfoState()

      const serversPath = join(path, 'servers.dat')

      const update = async () => {
        if (await exists(serversPath)) {
          const serverDat = await readFile(serversPath)
          const infos = /* await readInfo(serverDat) */ undefined as any
          this.log('Loaded server infos.')
          state.instanceServerInfos(infos)
        } else {
          this.log('No server data found in instance.')
        }
      }
      const watcher = watch(path, (event, filePath) => {
        if (event === 'update') {
            update()
        }
      })

      await update()

      return [state, () => {
        watcher.close()
      }]
    })
  }
}
