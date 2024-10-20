import { getServerInfoKey, InstanceServerInfoService as IInstanceServerInfoService, InstanceServerInfoServiceKey, ServerInfoState } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import watch from 'node-watch'
import { join } from 'path'
import { Inject, kGameDataPath, LauncherAppKey, PathResolver } from '~/app'
import { AbstractService, ExposeServiceKey, ServiceStateManager } from '~/service'
import { LauncherApp } from '../app/LauncherApp'
import { exists, hardLinkFiles, isHardLinked, unHardLinkFiles } from '../util/fs'

@ExposeServiceKey(InstanceServerInfoServiceKey)
export class InstanceServerInfoService extends AbstractService implements IInstanceServerInfoService {
  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(kGameDataPath) private getPath: PathResolver,
  ) {
    super(app)
  }

  async isLinked(instancePath: string): Promise<boolean> {
    const root = this.getPath('servers.dat')
    const instanceDat = join(instancePath, 'servers.dat')

    return isHardLinked(root, instanceDat)
  }

  async link(instancePath: string): Promise<void> {
    const root = this.getPath('servers.dat')
    const instanceDat = join(instancePath, 'servers.dat')

    await hardLinkFiles(root, instanceDat)
  }

  async unlink(instancePath: string): Promise<void> {
    const root = this.getPath('servers.dat')
    const instanceDat = join(instancePath, 'servers.dat')

    return unHardLinkFiles(root, instanceDat)
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
