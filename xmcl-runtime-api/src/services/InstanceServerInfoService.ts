import type { Status } from '@xmcl/client'
import type { ServerInfo } from '@xmcl/server-info'
import { UNKNOWN_STATUS } from '../entities/serverStatus'
import { ServiceKey, ServiceTemplate, State, StatefulService } from './Service'

export class ServerInfoWithStatus implements ServerInfo {
  status: Status = UNKNOWN_STATUS

  readonly acceptTextures
  readonly icon
  readonly ip
  readonly name

  constructor(info: ServerInfo) {
    this.acceptTextures = info.acceptTextures
    this.icon = info.icon
    this.ip = info.ip
    this.name = info.name
  }
}

export class ServerInfoState {
  /**
   * Cache loaded server info in servers.dat
   */
  serverInfos: ServerInfoWithStatus[] = []
  /**
  * Update server infos in server.dat
  * @param infos The new server infos
  */
  instanceServerInfos(infos: ServerInfo[]): void {
    this.serverInfos = infos.map(m => new ServerInfoWithStatus(m))
  }

  instanceServerStatusUpdate(current: Status[]) {
    for (let i = 0; i < current.length; i++) {
      this.serverInfos[i].status = current[i]
    }
  }
}

/**
 * Provide the service to access the servers.dat for an instance.
 */
export interface InstanceServerInfoService extends StatefulService<ServerInfoState> {
  /**
   * Refresh the data from server.dat file
   */
  refresh(): Promise<void>
  /**
   * Ping all server status in this instance server.dat file
   */
  pingServerStatus(): Promise<void>
}

export const InstanceServerInfoServiceKey: ServiceKey<InstanceServerInfoService> = 'InstanceServerInfoService'
export const InstanceServerInfoServiceMethods: ServiceTemplate<InstanceServerInfoService> = {
  refresh: undefined,
  pingServerStatus: undefined,
  state: undefined,
}
