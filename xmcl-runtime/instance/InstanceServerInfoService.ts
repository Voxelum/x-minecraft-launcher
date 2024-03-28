import { InstanceServerInfoService as IInstanceServerInfoService, InstanceServerInfoServiceKey, ServerInfoState, getServerInfoKey } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import watch from 'node-watch'
import { join } from 'path'
import { LauncherApp } from '../app/LauncherApp'
import { LauncherAppKey, Inject } from '~/app'
import { exists } from '../util/fs'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'

@ExposeServiceKey(InstanceServerInfoServiceKey)
export class InstanceServerInfoService extends AbstractService implements IInstanceServerInfoService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
  ) {
    super(app)
  }

  async watch(path: string) {
    const stateManager = await this.app.registry.get(ServiceStateManager)
    return stateManager.registerOrGet(getServerInfoKey(path), async ({ defineAsyncOperation }) => {
      const state = new ServerInfoState()

      const serversPath = join(path, 'servers.dat')

      const update = defineAsyncOperation(async () => {
        if (await exists(serversPath)) {
          const serverDat = await readFile(serversPath)
          const infos = /* await readInfo(serverDat) */ undefined as any
          this.log('Loaded server infos.')
          state.instanceServerInfos(infos)
        } else {
          this.log('No server data found in instance.')
        }
      })
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
