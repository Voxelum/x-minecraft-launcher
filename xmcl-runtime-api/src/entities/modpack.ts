/* eslint-disable camelcase */
import { InstanceData, RuntimeVersions } from './instance.schema'
import { InstanceFile } from './instanceManifest.schema'

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
  url?: string
}

export interface ModpackManifest {
  manifestType: string
  manifestVersion: number
  name: string
  version: string
  author: string
}

export type ModpackManifestResolved<T> = T & {
  resolved: Partial<InstanceData> & {
    files: InstanceFile[]
  }
}

export interface ModrinthModpackManifest {
  /**
   * The version of the format, stored as a number. The current value at the time of writing is 1.
   */
  formatVersion: number
  game: string
  /**
   * A unique identifier for this specific version of the modpack.
   */
  versionId: string
  /**
   * Human-readable name of the modpack.
   */
  name: string
  /**
   * A short description of this modpack.
   */
  summary?: string
  /**
   * The files array contains a list of files for the modpack that needs to be downloaded. Each item in this array contains the following:
   */
  files: Array<{
    /**
     * The destination path of this file, relative to the Minecraft instance directory.
     * For example, mods/MyMod.jar resolves to .minecraft/mods/MyMod.jar.
     */
    path: string
    /**
     * The hashes of the file specified. SHA1 is required, and other hashes are optional, but will usually be ignored. This is formatted as such:
     * ```
     * "hashes": {
     *   "sha1": "cc297357ff0031f805a744ca3a1378a112c2ddf4"
     * }
     * ```
     */
    hashes: Record<string, string>
    /**
     * For files that only exist on a specific environment, this field allows that to be specified.
     * It's an object which contains a client and server value. This uses the Modrinth client/server type specifications. For example:
     */
    env?: Record<'client' | 'server', 'required' | 'optional' | 'unsupported'>
    /**
     * An array containing RFC 3986 compliant URIs where this file may be downloaded.
     * URIs MUST NOT contain unencoded spaces or any other illegal characters according to RFC 3986.
     *
     * Only URIs from the following domains are allowed:
     * - cdn.modrinth.com
     * - edge.forgecdn.net (CurseForge)
     * - github.com
     * - raw.githubusercontent.com
     */
    downloads: string[]
    /**
     * An integer containing the size of the file, in bytes. This is mostly provided as a utility for launchers to allow use of progress bars.
     */
    fileSize?: number
  }>
  /**
   * This object contains a list of IDs and version numbers that launchers will use in order to know what to install.
   */
  dependencies: {
    minecraft: string
    forge?: string
    'fabric-loader'?: string
    'quilt-loader'?: string
  }
}

export interface McbbsModpackManifest extends ModpackManifest {
  /**
   * The manifest type. For mcbbs should be "minecraftModpack"
   */
  manifestType: 'minecraftModpack'
  /**
   * The version of the "minecraftModpack", latest should be `2`
   */
  manifestVersion: 2
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
  manifestVersion: 1
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

export function getInstanceConfigFromMcbbsModpack(manifest: McbbsModpackManifest) {
  return {
    name: `${manifest.name}-${manifest.version}`,
    author: manifest.author,
    modpackVersion: manifest.version,
    url: manifest.url,
    description: manifest.description,
    runtime: {
      minecraft: manifest.addons.find(a => a.id === 'game')?.version ?? '',
      forge: manifest.addons.find(a => a.id === 'forge')?.version ?? '',
      liteloader: '',
      fabricLoader: manifest.addons.find(a => a.id === 'fabric')?.version ?? '',
      yarn: '',
    },
    mcOptions: manifest.launchInfo ? manifest.launchInfo.launchArgument : undefined,
    vmOptions: manifest.launchInfo ? manifest.launchInfo.javaArgument : undefined,
    minMemory: manifest.launchInfo ? Number(manifest.launchInfo.minMemory) : undefined,
  }
}
export function getInstanceConfigFromCurseforgeModpack(manifest: CurseforgeModpackManifest) {
  const forgeId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('forge'))
  const fabricId = manifest.minecraft.modLoaders.find(l => l.id.startsWith('fabric'))
  return {
    name: `${manifest.name}-${manifest.version}`,
    modpackVersion: manifest.version,
    author: manifest.author,
    runtime: {
      minecraft: manifest.minecraft.version,
      forge: forgeId ? forgeId.id.substring(6) : '',
      liteloader: '',
      fabricLoader: fabricId ? fabricId.id.substring(7) : '',
      yarn: '',
    },
  }
}
export function getInstanceConfigFromModrinthModpack(manifest: ModrinthModpackManifest) {
  return {
    name: `${manifest.name}-${manifest.versionId}`,
    modpackVersion: manifest.versionId,
    description: manifest.summary,
    runtime: {
      minecraft: manifest.dependencies.minecraft,
      forge: manifest.dependencies.forge,
      fabricLoader: manifest.dependencies['fabric-loader'],
      quiltLoader: manifest.dependencies['quilt-loader'],
    },
  }
}
export function getModrinthModpackFromInstance(instance: InstanceData): ModrinthModpackManifest {
  return {
    formatVersion: 1,
    game: 'minecraft',
    versionId: instance.modpackVersion,
    name: instance.name,
    summary: instance.description,
    dependencies: {
      minecraft: instance.runtime.minecraft,
      forge: instance.runtime.forge || undefined,
      'fabric-loader': instance.runtime.fabricLoader || undefined,
      'quilt-loader': instance.runtime.quiltLoader || undefined,
    },
    files: [],
  }
}
export function getCurseforgeModpackFromInstance(instance: InstanceData): CurseforgeModpackManifest {
  const modLoaders = instance.runtime.forge
    ? [{
      id: `forge-${instance.runtime.forge}`,
      primary: true,
    }]
    : (instance.runtime.fabricLoader
      ? [{
        id: `fabric-${instance.runtime.fabricLoader}`,
        primary: true,
      }]
      : [])

  return {
    manifestType: 'minecraftModpack',
    manifestVersion: 1,
    minecraft: {
      version: instance.runtime.minecraft,
      modLoaders,
    },
    name: instance.name,
    version: instance.modpackVersion,
    author: instance.author,
    files: [],
    overrides: 'overrides',
  }
}
export function getMcbbsModpackFromInstance(instance: InstanceData): McbbsModpackManifest {
  const mcbbsManifest: McbbsModpackManifest = {
    manifestType: 'minecraftModpack',
    manifestVersion: 2,
    description: instance.description,
    url: instance.url,
    name: instance.name,
    version: instance.modpackVersion,
    author: instance.author,
    files: [],
    launchInfo: {
      minMemory: instance.minMemory && instance.minMemory <= 0 ? undefined : instance.minMemory,
      launchArgument: instance.mcOptions,
      javaArgument: instance.vmOptions,
    },
    addons: [{ id: 'game', version: instance.runtime.minecraft }],
  }
  if (instance.runtime.forge) {
    mcbbsManifest.addons.push({ id: 'forge', version: instance.runtime.forge })
  }
  if (instance.runtime.fabricLoader) {
    mcbbsManifest.addons.push({ id: 'fabric', version: instance.runtime.fabricLoader })
  }
  return mcbbsManifest
}
