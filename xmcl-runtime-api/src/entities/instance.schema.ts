/* eslint-disable no-redeclare */
import { InstanceFile } from './instanceManifest.schema'
import _InstanceSchema from './InstanceSchema.json'
import _InstancesSchema from './InstancesSchema.json'
import _InstanceLockSchema from './InstanceLockSchema.json'
import _InstanceInstallLockSchema from './InstanceInstallLockSchema.json'
import { Schema } from './schema'

export const InstanceSchema: Schema<InstanceSchema> = _InstanceSchema
export const InstancesSchema: Schema<InstancesSchema> = _InstancesSchema
export const InstanceLockSchema: Schema<InstanceLockSchema> = _InstanceLockSchema
export const InstanceInstallLockSchema: Schema<InstanceInstallLockSchema> = _InstanceInstallLockSchema

export interface RuntimeVersions {
  /**
   * Minecraft version of this version. e.g. 1.7.10
   * @default ""
   */
  minecraft: string
  /**
   * Forge version of this version. e.g. 14.23.5.2838
   * @default ""
   */
  forge?: string
  /**
   * NeoForged version of this version. e.g. 14.23.5.2838
   * @default ""
   */
  neoForged?: string
  /**
     * @default ""
     */
  liteloader?: string
  /**
   * Fabric loader version, e.g. 0.7.2+build.175
   * @default ""
   */
  fabricLoader?: string
  /**
   * @default ""
   */
  quiltLoader?: string
  /**
   * Fabric yarn version, e.g. 1.15.1+build.14
   * @default ""
   * @deprecated
   */
  yarn?: string
  /**
   * Optifine version e.g. HD_U_F1_pre6 or HD_U_E6
   * @default ""
   */
  optifine?: string
  /**
   * The labyMod version
   * @default ""
   */
  labyMod?: string

  [id: string]: undefined | string
}

export interface ModrinthUpstream {
  type: 'modrinth-modpack'
  projectId: string
  versionId: string
  sha1?: string
}

export interface CurseforgeUpstream {
  type: 'curseforge-modpack'
  modId: number
  fileId: number
  sha1?: string
}

export interface FTBUpstream {
  type: 'ftb-modpack'
  id: number
  versionId: number
}

export interface PeerUpstream {
  type: 'peer'
  id: string
}

export interface InstanceData {
  /**
   * The display name of the profile. It will also be the modpack display name
   * @default ""
   */
  name: string
  /**
   * The author of this instance
   * @default ""
   */
  author: string
  /**
   * The description of this instance
   * @default ""
   */
  description: string
  /**
   * Should show a logger window after Minecraft launched
   */
  showLog?: boolean
  /**
   * Should launcher hide after Minecraft launched
   */
  hideLauncher?: boolean
  /**
   * Launch without checking the problems and account
   */
  fastLaunch?: boolean
  /**
   * The target version id to launch. It will be computed from "runtime"
   * @default ""
   */
  version: string
  /**
   * The runtime version requirement of the profile.
   *
   * Containing the forge & liteloader & etc.
   * @default { "minecraft": "", "forge": "", "liteloader": "" }
   */
  runtime: RuntimeVersions
  /**
   * The java path on the disk
   */
  java?: string
  /**
   * The resolution of the game
   */
  resolution?: { width: number; height: number; fullscreen: boolean } | null
  /**
   * Can be override by global setting
    */
  minMemory?: number
  /**
   * Can be override by global setting
    */
  maxMemory?: number
  /**
   * Can be override by global setting
   */
  assignMemory?: true | 'auto' | false
  /**
   *
   */
  vmOptions?: string[]
  /**
   *
   */
  mcOptions?: string[]
  /**
   * The launch environment variables
   */
  env?: Record<string, string>

  prependCommand?: string
  /**
   * @default ""
   */
  url: string
  /**
   * @default ""
   */
  icon: string
  /**
   * The version number of the modpack. This only available for modpack
   * @default ""
   */
  modpackVersion: string
  /**
   * @default ""
   */
  fileApi: string
  /**
   * The option for instance to launch server directly
   * @default null
   */
  server: {
    host: string
    port?: number
  } | null
  /**
   * The custom tags on instance
   * @default []
   */
  tags: string[]
  /**
   */
  disableElybyAuthlib?: boolean
  /**
   */
  disableAuthlibInjector?: boolean

  useLatest?: false | 'release' | 'alpha'

  playTime?: number
  lastPlayedDate?: number

  upstream?: InstanceUpstream
}

export type InstanceUpstream = CurseforgeUpstream | ModrinthUpstream | FTBUpstream | PeerUpstream

/**
 * The instance lock schema. Represent the intermediate state of the instance files.
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface InstanceLockSchema {
  /**
   * The instance lock
   * @default 1
   */
  version: number
  /**
   * The upstream data for this locked instance file state
   */
  upstream: InstanceUpstream
  /**
   * All the files accociated with current upstream
   */
  files: InstanceFile[]
  /**
   * The files max mtime of the last install
   */
  mtime: number
}

/**
 * Represent a intermediate state of the instance files.
 */
export interface InstanceInstallLockSchema extends InstanceLockSchema {
  /**
   * The finished files path
   */
  finishedPath: string[]
  /**
   * The backup files path
   */
  backup: string
  /**
   * The install workspace path
   */
  workspace: string
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface InstanceSchema extends InstanceData {
  /**
   * @default 0
   */
  lastAccessDate: number
  /**
   * @default 0
   */
  lastPlayedDate: number
  /**
   * @default 0
   */
  playtime: number
  /**
   * @default 0
   */
  creationDate: number
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export interface InstancesSchema {
  /**
   * @default ""
   */
  selectedInstance: string
  /**
   * The extra imported instance path
   * @default []
   */
  instances: string[]
}

// export interface Instance {
//   config: InstanceSchema
// }
