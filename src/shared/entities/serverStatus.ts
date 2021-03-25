import type { Status as ServerStatus } from '@xmcl/client'

export { ServerStatus }

export const UNKNOWN_STATUS: ServerStatus = Object.freeze({
  version: {
    name: 'profile.server.unknown',
    protocol: -1,
  },
  players: {
    max: -1,
    online: -1,
  },
  description: 'profile.server.unknownDescription',
  favicon: '',
  ping: 0,
})

export const PINGING_STATUS: ServerStatus = Object.freeze({
  version: {
    name: 'profile.server.ping',
    protocol: -1,
  },
  players: {
    max: -1,
    online: -1,
  },
  description: 'profile.server.pinging',
  favicon: '',
  ping: 0,
})

export function createFailureServerStatus (description: string): ServerStatus {
  return Object.freeze({
    version: {
      name: 'profile.server.unknown',
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

export function getHostAndPortFromIp (ip: string) {
  const [host, port] = ip.split(':')
  return { host, port: port ? Number.parseInt(port, 10) : 25565 }
}
