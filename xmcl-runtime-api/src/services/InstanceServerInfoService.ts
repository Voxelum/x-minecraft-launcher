import type { Status } from '@xmcl/client'
import type { ServerInfo } from '@xmcl/game-data'
import { UNKNOWN_STATUS } from '../entities/serverStatus'
import { ServiceKey } from './Service'

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

export function getServerInfoKey(path: string) {
  return 'instance-server-data://' + path
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
}

/**
 * Provide the service to access the servers.dat for an instance.
 */
export interface InstanceServerInfoService {
  /**
   * Watch the server info in the instance folder.
   * @param instancePath The instance folder path
   */
  watch(instancePath: string): Promise<ServerInfoState>
}

export const InstanceServerInfoServiceKey: ServiceKey<InstanceServerInfoService> = 'InstanceServerInfoService'
