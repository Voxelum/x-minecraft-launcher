/* eslint-disable no-redeclare */
import _InstanceSchema from './InstanceSchema.json'
import _InstancesSchema from './InstancesSchema.json'
import { Schema } from './schema'

export const InstanceSchema: Schema<InstanceSchema> = _InstanceSchema
export const InstancesSchema: Schema<InstancesSchema> = _InstancesSchema

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

  [id: string]: undefined | string
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
   * @default false
   */
  showLog: boolean
  /**
   * Should launcher hide after Minecraft launched
   * @default true
   */
  hideLauncher: boolean
  /**
   * @default false
   */
  fastLaunch: boolean
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
   * @default ""
   */
  java: string
  /**
   * The resolution of the game
   */
  resolution: { width: number; height: number; fullscreen: boolean } | null
  /**
    * @default 0
    */
  minMemory: number
  /**
    * @default 0
    */
  maxMemory: number
  /**
   * @default true
   */
  assignMemory: true | 'auto' | false
  /**
   * @default []
   */
  vmOptions: string[]
  /**
   * @default []
   */
  mcOptions: string[]
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
