/* eslint-disable camelcase */
import { RuntimeVersions } from './instance.schema'

/**
 * Represent a common modpack metadata in a zip file.
 */
export interface Modpack {
  /**
   * The relative path to the root of minecraft data folder. Normally should be the root folder '.' or '.minecraft' folder
   */
  root: string
  /**
   * Provided version
   */
  runtime: RuntimeVersions
}

export interface ModpackManifest {
  manifestType: string
  manifestVersion: number
  name: string
  version: string
  author: string
}

/**
 * The addon representing the runtime for the modpack, like forge
 */
export interface ModpackAddon {
  id: string
  version: string
}

export interface ModpackFileInfo {
  force: boolean
  type: string
}

/**
 * Represent a file from curseforge
 */
export interface ModpackFileInfoCurseforge extends ModpackFileInfo {
  type: 'curse'
  projectID: number
  fileID: number
}

/**
 * Represent a file from fileApi
 */
export interface ModpackFileInfoAddon extends ModpackFileInfo {
  type: 'addon'
  path: string
  hash: string
}

export interface McbbsModpackManifest extends ModpackManifest {
  /**
   * The manifest type. For mcbbs should be "minecraftModpack"
   */
  manifestType: string
  /**
   * The version of the "minecraftModpack", latest should be `2`
   */
  manifestVersion: number
  /**
   * Description of the modpack
   */
  description: string
  /**
   * The url of the modpack release page
   */
  url: string
  /**
   * The file API for update modpack
   */
  fileApi?: string
  /**
   * If this modpack require force update
   * @default false
   */
  forceUpdate?: boolean
  /**
   * The design is not done yet
   * @unimplemented
   */
  origin?: {
    type: string
    id: number
  }[]
  /**
   * The addon/runtime of the modpack
   */
  addons: ModpackAddon[]
  /**
   * The design is not done yet
   * @unimplemented
   */
  libraries?: {
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
  }[]
  /**
   * The files should be download or resolved from remote to local
   */
  files?: Array<ModpackFileInfoAddon | ModpackFileInfoCurseforge>

  /**
   * @unimplemented
   */
  settings?: {
    install_mods: boolean
    install_resourcepack: boolean
  }
  /**
   * The suggested launcher info
   */
  launchInfo?: {
    minMemory?: number
    supportJava?: number[]
    launchArgument?: string[]
    javaArgument?: string[]
  }
  serverInfo?: {
    /**
     * The third party skin service url
     */
    authlibInjectorServer?: string
  }
  /**
   * @unimplemented
   */
  sandbox?: {
    allowPath: string[]
    permissionGranted: string[]
  }
  /**
   * @unimplemented
   */
  antiCheating?: {
    core: string
    hash: string
  }
}

/**
 * The modpack metadata structure
 */
export interface CurseforgeModpackManifest extends ModpackManifest {
  minecraft: {
    version: string
    libraries?: string
    modLoaders: {
      id: string
      primary: boolean
    }[]
  }
  files: {
    projectID: number
    fileID: number
    required: boolean
  }[]
  overrides: string
}
