import { readInfo } from '@xmcl/server-info'
import { readFile } from 'fs-extra'
import { join } from 'path'
import AbstractService, { ExportService, Singleton, Subscribe } from './Service'
import LauncherApp from '/@main/app/LauncherApp'
import { exists } from '/@main/util/fs'
import { InstanceServerInfoService as IInstanceServerInfoService, InstanceServerInfoServiceKey } from '/@shared/services/InstanceServerInfoService'
import { requireString } from '/@shared/util/assert'

/**
 * Provide instance spliting service. It can split the game into multiple environment and dynamiclly deploy the resource to run.
 */
@ExportService(InstanceServerInfoServiceKey)
export class InstanceServerInfoService extends AbstractService implements IInstanceServerInfoService {
  constructor(app: LauncherApp) {
    super(app)

    this.storeManager
      .subscribe('instanceServerInfos', async (payload) => {
        // await this.instanceFile.saveTo(payload.path, payload)
        // await this.instancesFile.save()
        // this.log(`Saved new instance ${payload.path}`)
      })
  }

  @Subscribe('instanceSelect')
  async refresh() {
    this.loadInstanceServerData(this.state.instance.path)
  }

  @Singleton()
  async loadInstanceServerData(path: string) {
    requireString(path)

    try {
      const serversPath = join(path, 'servers.dat')
      if (await exists(serversPath)) {
        const serverDat = await readFile(serversPath)
        const infos = await readInfo(serverDat)
        this.log('Loaded server infos.')
        this.commit('instanceServerInfos', infos)
      }
      this.log('No server data found in instance.')
    } catch (e) {
      this.warn(`An error occured during loading server infos of ${path}`)
      this.error(e)
    }
  }
}

export default InstanceServerInfoService
