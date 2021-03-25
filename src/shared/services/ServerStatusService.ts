import { Status } from '@xmcl/client'
import { ServiceKey } from './Service'

export interface ServerStatusService {
  pingServer(payload: {
    host: string
    port?: number
    protocol?: number
  }): Promise<Status>

  pingServers(): Promise<{
    icon: string
    ip: string
    name: string
    acceptTextures: number
    status: Status
  }[]>
}

export const ServerStatusServiceKey: ServiceKey<ServerStatusService> = 'ServerStatusService'
