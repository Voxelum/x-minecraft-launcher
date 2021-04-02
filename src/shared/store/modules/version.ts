import { LATEST_RELEASE } from '/@shared/entities/version'
import { ForgeVersionList, VersionFabricSchema, VersionForgeSchema, VersionLiteloaderSchema, VersionMinecraftSchema, VersionOptifineSchema } from '/@shared/entities/version.schema'
import { ResolvedVersion } from '@xmcl/core'
import type { FabricArtifactVersion, LiteloaderVersionList, MinecraftVersion, MinecraftVersionList } from '@xmcl/installer'
import { ModuleOption } from '../root'

interface State {
  /**
   * All the local versions installed in the disk
   */
  local: ResolvedVersion[]
  /**
     * Minecraft version metadata list. Helps to download.
     */
  minecraft: VersionMinecraftSchema
  /**
     * Forge version metadata dictionary. Helps to download.
     */
  forge: VersionForgeSchema
  /**
     * Fabric version metadata dictionary. Helps to download.
     */
  fabric: VersionFabricSchema
  /**
     * Liteloader version metadata list. Helps to download.
     */
  liteloader: VersionLiteloaderSchema
  /**
     * The optifine version list
     */
  optifine: VersionOptifineSchema
}

interface Getters {
  /**
     * Latest snapshot
     */
  minecraftSnapshot: MinecraftVersion | undefined
  /**
     * Latest release
     */
  minecraftRelease: MinecraftVersion
  minecraftVersion: (mcversion: string) => MinecraftVersion | undefined
}

export interface Mutations {
  localVersions: ResolvedVersion[]
  localVersion: ResolvedVersion
  localVersionRemove: string
  minecraftMetadata: MinecraftVersionList
  optifineMetadata: VersionOptifineSchema
  forgeMetadata: ForgeVersionList
  liteloaderMetadata: LiteloaderVersionList
  fabricYarnMetadata: { versions: FabricArtifactVersion[]; timestamp: string }
  fabricLoaderMetadata: { versions: FabricArtifactVersion[]; timestamp: string }
}

export type VersionModule = ModuleOption<State, Getters, Mutations, {}>

const mod: VersionModule = {
  state: {
    /**
     * local versions
     */
    local: [],
    minecraft: {
      timestamp: '',
      latest: {
        snapshot: '',
        release: '',
      },
      versions: [],
    },
    forge: [],
    liteloader: {
      timestamp: '',
      meta: {
        description: '',
        authors: '',
        url: '',
        updated: '',
        updatedTime: 0,
      },
      versions: {},
    },
    fabric: {
      yarnTimestamp: '',
      loaderTimestamp: '',
      yarns: [],
      loaders: [],
    },
    optifine: {
      etag: '',
      versions: [],
    },
  },
  getters: {
    /**
     * latest snapshot
     */
    minecraftSnapshot: state => state.minecraft.versions.find(v => v.id === state.minecraft.latest.snapshot),
    /**
     * latest release
     */
    minecraftRelease: state => state.minecraft.versions.find(v => v.id === state.minecraft.latest.release) || LATEST_RELEASE,

    minecraftVersion: state => version => state.minecraft.versions.find(v => v.id === version),
  },
  mutations: {
    localVersions(state, local) {
      local.forEach(Object.freeze)
      state.local = local
    },
    localVersion(state, local) {
      Object.freeze(local)
      const found = state.local.findIndex(l => l.id === local.id)
      if (found !== -1) {
        state.local[found] = local
      } else {
        state.local.push(local as any)
        state.local = state.local.sort((a, b) => a.id.localeCompare(b.id))
      }
    },
    localVersionRemove(state, folder) {
      state.local = state.local.filter(v => v.id === folder)
    },
    minecraftMetadata(state, metadata) {
      state.minecraft = Object.freeze(metadata)
    },
    forgeMetadata(state, metadata) {
      const existed = state.forge.find((version) => version.mcversion === metadata.mcversion)
      if (existed) {
        existed.timestamp = metadata.timestamp
        existed.versions = Object.freeze(metadata.versions)
      } else {
        const result = { ...metadata, versions: Object.freeze(metadata.versions) }
        state.forge.push(result)
      }
    },
    liteloaderMetadata(state, metadata) {
      state.liteloader = Object.freeze(metadata)
    },
    fabricYarnMetadata(state, { versions, timestamp }) {
      state.fabric.yarnTimestamp = timestamp
      state.fabric.yarns = Object.seal(versions)
    },
    fabricLoaderMetadata(state, { versions, timestamp }) {
      state.fabric.loaderTimestamp = timestamp
      state.fabric.loaders = Object.seal(versions)
    },
    optifineMetadata(state, { versions, etag: timestamp }) {
      state.optifine.versions = Object.seal(versions)
      state.optifine.etag = timestamp
    },
  },
}

export default mod
