import { InstanceSchema } from './instance.schema'

export interface Instance extends InstanceSchema {
  path: string
}

export const DEFAULT_PROFILE: Instance = Object.freeze(createTemplate())

export function createTemplate(): Instance {
  const base: Instance = {
    path: '',
    name: '',

    resolution: { width: 800, height: 400, fullscreen: false },
    minMemory: 0,
    maxMemory: 0,
    vmOptions: undefined,
    mcOptions: undefined,

    url: '',
    icon: '',

    runtime: {
      minecraft: '',
      forge: '',
      liteloader: '',
      fabricLoader: '',
      yarn: '',
      optifine: '',
      quiltLoader: '',
      neoForged: '',
      labyMod: '',
    },
    java: '',
    version: '',
    server: null,

    author: '',
    description: '',

    lastAccessDate: -1,
    creationDate: -1,
    modpackVersion: '',
    fileApi: '',
    tags: [],

    assignMemory: false,
    showLog: undefined,
    hideLauncher: undefined,
    disableAuthlibInjector: undefined,
    disableElybyAuthlib: undefined,
    fastLaunch: undefined,
    upstream: undefined,
    lastPlayedDate: 0,
    playtime: 0,
  }
  return base
}
