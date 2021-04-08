/* eslint-disable camelcase */
import { ModpackManifest } from './modpack'

export interface Origin {
  type: string
  id: number
}

export interface Addon {
  id: string
  version: string
}

export interface Library {
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

export interface FileInfo {
  force: boolean
  type: string
}

export interface FileInfoCurseforge extends FileInfo {
  type: 'curse'
  projectID: number
  fileID: number
}

export interface FileInfoAddon extends FileInfo {
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
  addons: Addon[]
  libraries?: Library[]
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
