import { Version } from '@xmcl/core'

/**
 * https://github.com/huanghongxun/HMCL/wiki/HMCL-%E6%95%B4%E5%90%88%E5%8C%85%E8%A7%84%E8%8C%83
 * The modpack.json
 */
export interface HMCLModpack {
  name: string
  author: string
  /**
   * Version of modpack
   */
  version: string
  /**
   * 整合包的Minecraft版本，建议填写，在HMCL 2.9以后生效
   */
  gameVersion: string
  /**
   * The description. It can be html or markdown.
   */
  description: string
}

export interface HMCLServerManagedModpack extends HMCLModpack {
  /**
   * Your modpack websites. This is displayed to user.
   */
  url?: string[] | string
  /**
   * If this modpack allow the server update this pack.
   * Then this should be modpack root url for each file.
   *
   * For example, once the modpack is deployed, a file `overrides/config/forge.cfg` is deployed.
   * If the fileApi is `https://some.website.com/modpack`, then the file should be avaiable on `https://some.website.com/modpack/overrides/config/forge.cfg`
   */
  fileApi: string
  /**
   *  The update rule
   * - `full`, if user modifiess the modpack, then it will be overwrited once the modpack is updated. User added files will be removed!
   * - `normal`, user is allowed to modify the modpack in this mode. The modified file won't be overwrited.
   * @default full
   */
  update: 'full' | 'normal'
  addons: Addon[]
  /**
   * The library need to install. This is optional
   */
  libraries?: Library[]
  /**
   * Contains the files need to be downloaded from internet
   */
  files: FileInfo[]
}

/**
 * Represnet a file need to be downloaded from internet
 */
export interface FileInfo {
  /**
   * The relative path of the file in minecraft
   */
  path: string
  /**
   * The sha1 of the file
   */
  hash: string
  /**
   * The file download url
   */
  url?: string
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
  filename: string
  hint: 'local'
}

/**
 * The addon id of HMCL. The `game` means minecraft.
 */
export type AddonId = 'game' | 'forge' | 'fabric' | 'liteloader' | 'optifine'

/**
 * An addon will install multiple (thrid party) library to the game.
 */
export interface Addon {
  /**
   * "game" for minecraft. "forge" for minecraft forge
   */
  id: AddonId | string
  /**
   * The version of the addon. For forge, it has to match BMCLAPI's version
   */
  version: string
}

/**
 * The patch version is either a partial addon, or a real resolved version json content.
 *
 * The patch version will apply to the root version and form a launchable version.
 */
export interface PatchedVersion extends Version {
  /**
   * The HMCL addon id. If this version is not mapped to addon id, this will be `resolved.<real version id>`.
   */
  id: AddonId | string
  /**
   * If the id is an addon id, this will be presented as version of the addon.
   */
  version?: string
  /**
   * The priority of the version. The larger one depends on smaller one
   */
  priority?: number
}

/**
 * The special version format resolved by HMCL
 */
export interface HMCLVersion extends Partial<Version> {
  /**
   * The displayed version id
   */
  id: string
  jar: string
  /**
   * Is the version root
   */
  root: boolean
  /**
   * Should version be hidden/not shown in UI (I guess)
   */
  hidden: boolean
  /**
   * The all version patches apply to this version
   */
  patches: PatchedVersion[]
}
