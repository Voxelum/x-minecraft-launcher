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
    modpackVersion: '',
    fileApi: '',
    tags: [],
  }
  return base
}

/**
 * The addon representing the runtime for the modpack, like forge
 */
export interface GameAddon {
  id: string
  version: string
}

/**
 * Represent a file from curseforge
 */
export interface InstanceFileCurseforge {
  type: 'curse'
  projectID: number
  fileID: number
  path?: string
  hash?: string
}

/**
 * Represent a file from fileApi
 */
export interface InstanceFileUrl {
  type?: 'addon'
  path: string
  hash: string
  url: string
}

export interface InstanceFileModrinth {
  type: 'modrinth'
  projectId: string
  versionId: string
  path?: string
  hash?: string
}

/**
 * The minimum info required to update instance
 */
export interface InstanceManifest {
  /**
   * The addon/runtime of the modpack
   */
  addons: GameAddon[]

  files: Array<InstanceFileCurseforge | InstanceFileUrl | InstanceFileModrinth>

  /**
   * The suggested launcher info
   */
  launchInfo?: {
    minMemory?: number
    supportJava?: number[]
    launchArgument?: string[]
    javaArgument?: string[]
  }
}
