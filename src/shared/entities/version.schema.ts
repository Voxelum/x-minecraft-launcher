/* eslint-disable @typescript-eslint/no-redeclare */
/* eslint-disable @typescript-eslint/no-var-requires */
import { Schema } from './schema'

import _VersionMinecraftSchema from './VersionMinecraftSchema.json'
import _VersionForgeSchema from './VersionForgeSchema.json'
import _VersionLiteloaderSchema from './VersionLiteloaderSchema.json'
import _VersionFabricSchema from './VersionFabricSchema.json'
import _VersionOptifineSchema from './VersionOptifineSchema.json'

export const VersionMinecraftSchema: Schema<VersionMinecraftSchema> = _VersionMinecraftSchema
export const VersionForgeSchema: Schema<VersionForgeSchema> = _VersionForgeSchema
export const VersionLiteloaderSchema: Schema<VersionLiteloaderSchema> = _VersionLiteloaderSchema
export const VersionFabricSchema: Schema<VersionFabricSchema> = _VersionFabricSchema
export const VersionOptifineSchema: Schema<VersionOptifineSchema> = _VersionOptifineSchema

export interface MinecraftVersion {
  id: string
  type: string
  time: string
  releaseTime: string
  url: string
}
export interface ForgeDownload {
  md5?: string
  sha1: string
  /**
     * The url path to concat with forge maven
     */
  path: string
}
export interface ForgeVersion {
  /**
     * The minecraft version
     */
  mcversion: string
  /**
     * The forge version (without minecraft version)
     */
  version: string
  /**
   * @default ""
   */
  date: string
  installer?: ForgeDownload
  universal?: ForgeDownload
  /**
     * The changelog info
     */
  changelog?: ForgeDownload
  mdk?: ForgeDownload
  source?: ForgeDownload
  launcher?: ForgeDownload
  /**
     * The type of the forge release. The `common` means the normal release.
     * @default "common"
     */
  type: 'buggy' | 'recommended' | 'common' | 'latest'
}
export interface ForgeVersionList {
  /**
     * @default ""
     */
  timestamp: string
  /**
     * @default []
     */
  versions: readonly ForgeVersion[]
  /**
     * @default ""
     */
  mcversion: string
}

interface LiteloaderVersionMeta {
  version: string
  url: string
  file: string
  mcversion: string
  type: 'RELEASE' | 'SNAPSHOT'
  md5: string
  timestamp: string
  libraries: Array<{
    name: string
    url?: string
  }>
  tweakClass: string
}

export interface VersionMinecraftSchema {
  /**
     * @default ""
     */
  timestamp: string
  /**
     * @default { "snapshot": "", "release": "" }
     */
  latest: {
    /**
         * Snapshot version id of the Minecraft
         * @default ""
         */
    snapshot: string
    /**
         * Release version id of the Minecraft, like 1.14.2
         * @default ""
         */
    release: string
  }
  /**
     * All the vesrsion list
     * @default []
     */
  versions: MinecraftVersion[]
}

export type VersionForgeSchema = Array<ForgeVersionList>
export interface VersionLiteloaderSchema {
  /**
     * @default ""
     */
  timestamp: string
  /**
     * @default {}
     */
  meta: {
    description: string
    authors: string
    url: string
    updated: string
    updatedTime: number
  }
  /**
     * @default {}
     */
  versions: {
    [version: string]: {
      snapshot?: LiteloaderVersionMeta
      release?: LiteloaderVersionMeta
    }
  }
}

interface FabricArtifactVersion {
  gameVersion?: string
  separator?: string
  build?: number
  maven: string
  version: string
  stable: boolean
}

export interface VersionFabricSchema {
  /**
     * @default ""
     */
  yarnTimestamp: string

  /**
     * @default ""
     */
  loaderTimestamp: string

  /**
     * @default []
     */
  yarns: FabricArtifactVersion[]

  /**
     * @default []
     */
  loaders: FabricArtifactVersion[]
}

export interface OptifineVersion {
  /**
     * The minecraft version
     */
  mcversion: string
  /**
     * The type of the optifine like HD_U
     */
  type: string
  /**
     * The patch of the optifine
     */
  patch: string
}

export interface VersionOptifineSchema {
  /**
     * @default []
     */
  versions: OptifineVersion[]
  /**
     * @default ""
     */
  etag: string
}
