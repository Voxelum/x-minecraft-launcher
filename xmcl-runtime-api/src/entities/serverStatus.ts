import type { Status as ServerStatus } from '@xmcl/client'

export { ServerStatus }

export const UNKNOWN_STATUS: ServerStatus = ({
  version: {
    name: 'server.unknown',
    protocol: -1,
  },
  players: {
    max: -1,
    online: -1,
  },
  description: 'server.unknownDescription',
  favicon: '',
  ping: 0,
})

export const PINGING_STATUS: ServerStatus = ({
  version: {
    name: 'server.ping',
    protocol: -1,
  },
  players: {
    max: -1,
    online: -1,
  },
  description: 'server.pinging',
  favicon: '',
  ping: 0,
})

export function createFailureServerStatus(description: string): ServerStatus {
  return Object.freeze({
    version: {
      name: 'server.unknown',
      protocol: -1,
    },
    players: {
      max: -1,
      online: -1,
    },
    description,
    favicon: '',
    ping: -1,
  })
}

export function getHostAndPortFromIp(ip: string) {
  const [host, port] = ip.split(':')
  return { host, port: port ? Number.parseInt(port, 10) : 25565 }
}
