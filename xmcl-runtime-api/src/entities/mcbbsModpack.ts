/* eslint-disable camelcase */
import { ModpackManifest } from './modpack'

export interface Origin {
  type: string
  id: number
}

export interface ModpackAddon {
  id: string
  version: string
}

export interface ModpackLibrary {
  /**
   * The library need to be installed.
   *
   * For example: "cn.skinme.skinme-loader"
   */
  name: string
  /**
   * The name of the library
   */
  fileName: string
  hint: 'local'
}

export interface ModpackFileInfo {
  force: boolean
  type: string
}

export interface ModpackFileInfoCurseforge extends ModpackFileInfo {
  type: 'curse'
  projectID: number
  fileID: number
}

export interface ModpackFileInfoAddon extends ModpackFileInfo {
  type: 'addon'
  path: string
  hash: string
}

export interface McbbsModpackManifest extends ModpackManifest {
  description: string
  fileApi?: string
  url: string
  forceUpdate: boolean
  origin?: Origin[]
  addons: ModpackAddon[]
  libraries?: ModpackLibrary[]
  settings: {
    install_mods: boolean
    install_resourcepack: boolean
  }
  launchInfo?: {
    minMemory?: number
    supportJava?: number[]
    launchArgument?: string[]
    javaArgument?: string[]
  }
  serverInfo?: {
    authlibInjectorServer?: string
  }
  sandbox?: {
    allowPath: string[]
    permissionGranted: string[]
  }
  antiCheating?: {
    core: string
    hash: string
  }
}
