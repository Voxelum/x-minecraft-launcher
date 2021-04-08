import { InstanceSchema } from './instance.schema'
import { ServerStatus, UNKNOWN_STATUS } from './serverStatus'

export interface Instance extends InstanceSchema {
  path: string

  /**
   * The server status
   */
  serverStatus: ServerStatus
}

export const DEFAULT_PROFILE: InstanceSchema = Object.freeze(createTemplate())

export function createTemplate(): Instance {
  const base: Instance = {
    path: '',
    name: '',

    resolution: { width: 800, height: 400, fullscreen: false },
    minMemory: 0,
    maxMemory: 0,
    vmOptions: [],
    mcOptions: [],

    url: '',
    icon: '',

    showLog: false,
    hideLauncher: true,

    runtime: {
      minecraft: '',
      forge: '',
      liteloader: '',
      fabricLoader: '',
      yarn: '',
      optifine: '',
    },
    java: '',
    version: '',
    server: null,

    author: '',
    description: '',

    lastAccessDate: -1,
    creationDate: -1,
    serverStatus: UNKNOWN_STATUS,
  }
  return base
}
