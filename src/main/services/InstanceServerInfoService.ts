import { readInfo } from '@xmcl/server-info'
import { readFile } from 'fs-extra'
import { join } from 'path'
import ServerStatusService from './ServerStatusService'
import { ExportService, Inject, Singleton, StatefulService, Subscribe } from './Service'
import LauncherApp from '/@main/app/LauncherApp'
import { exists } from '/@main/util/fs'
import { PINGING_STATUS } from '/@shared/entities/serverStatus'
import { InstanceServerInfoService as IInstanceServerInfoService, InstanceServerInfoServiceKey, ServerInfoState } from '/@shared/services/InstanceServerInfoService'

@ExportService(InstanceServerInfoServiceKey)
export class InstanceServerInfoService extends StatefulService<ServerInfoState> implements IInstanceServerInfoService {
  private watching = ''

  constructor(app: LauncherApp,
    @Inject(ServerStatusService) private serverStatusService: ServerStatusService,
  ) {
    super(app)
  }

  createState() { return new ServerInfoState() }

  @Subscribe('instanceSelect')
  async onInstanceSelect(path: string) {
    this.watching = path
    this.refresh()
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
