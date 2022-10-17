import { InstanceServerInfoService as IInstanceServerInfoService, InstanceServerInfoServiceKey, PINGING_STATUS, ServerInfoState } from '@xmcl/runtime-api'
import { readFile } from 'fs-extra'
import { join } from 'path'
import LauncherApp from '../app/LauncherApp'
import { LauncherAppKey } from '../app/utils'
import { exists } from '../util/fs'
import { Inject } from '../util/objectRegistry'
import { ServerStatusService } from './ServerStatusService'
import { ExposeServiceKey, Singleton, StatefulService } from './Service'

@ExposeServiceKey(InstanceServerInfoServiceKey)
export class InstanceServerInfoService extends StatefulService<ServerInfoState> implements IInstanceServerInfoService {
  private watching = ''

  constructor(@Inject(LauncherAppKey) app: LauncherApp,
    @Inject(ServerStatusService) private serverStatusService: ServerStatusService,
  ) {
    super(app,  () => new ServerInfoState())
    this.storeManager.subscribe('instanceSelect', (path: string) => {
      this.watching = path
      this.refresh()
    })
  }

  @Singleton()
  async refresh() {
    if (this.watching) {
      try {
        const serversPath = join(this.watching, 'servers.dat')
        if (await exists(serversPath)) {
          const serverDat = await readFile(serversPath)
          const infos = /* await readInfo(serverDat) */ undefined as any
          this.log('Loaded server infos.')
          this.state.instanceServerInfos(infos)
        } else {
          this.log('No server data found in instance.')
        }
      } catch (e) {
        this.warn(`An error occured during loading server infos of ${this.watching}`)
        this.error(e)
      }
    }
  }

  async pingServerStatus(): Promise<void> {
    const saved = this.state.serverInfos
    this.state.instanceServerStatusUpdate(saved.map(() => PINGING_STATUS))
    const result = await Promise.all(saved.map((info) => {
      const [host, port] = info.ip.split(':')
      return this.serverStatusService.pingServer({ host, port: Number.parseInt(port ?? 25565) })
    }))
    if (this.state.serverInfos === saved) {
      this.state.instanceServerStatusUpdate(result)
    } else {
      await this.pingServerStatus()
    }
  }
}

export default InstanceServerInfoService
