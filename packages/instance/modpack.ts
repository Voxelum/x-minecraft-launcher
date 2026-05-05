import { InstanceData, PartialRuntimeVersions, RuntimeVersions } from './instance'
import { InstanceFile } from './files'
import { CreateInstanceOptions } from './create'

/**
 * Third-party launcher manifest structure
 */
export interface ThirdPartyLauncherManifest {
  instances: Array<{
    path: string
    options: CreateInstanceOptions
  }>
  folder: {
    versions: string
    libraries: string
    assets: string
    jre?: string
  }
}

/**
 * Supported instance types for parsing
 */
export type InstanceType = 'mmc' | 'vanilla' | 'modrinth' | 'curseforge'

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

/**
 * Modrinth modpack manifest format
 */
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
   * The files array contains a list of files for the modpack that needs to be downloaded.
   */
  files: Array<{
    /**
     * The destination path of this file, relative to the Minecraft instance directory.
     */
    path: string
    /**
     * The hashes of the file specified. SHA1 is required, and other hashes are optional.
     */
    hashes: Record<string, string>
    /**
     * For files that only exist on a specific environment.
     */
    env?: Record<'client' | 'server', 'required' | 'optional' | 'unsupported'>
    /**
     * An array containing RFC 3986 compliant URIs where this file may be downloaded.
     */
    downloads: string[]
    /**
     * An integer containing the size of the file, in bytes.
     */
    fileSize?: number
  }>
  /**
   * This object contains a list of IDs and version numbers that launchers will use in order to know what to install.
   */
  dependencies: {
    minecraft: string
    forge?: string
    neoforge?: string
    'fabric-loader'?: string
    'quilt-loader'?: string
  }
}

/**
 * MultiMC modpack manifest format
 */
export interface MMCModpackManifest {
  json: {
    components: Array<{
      uid:
        | 'net.minecraft'
        | 'net.minecraftforge'
        | 'net.fabricmc.fabric-loader'
        | 'net.quiltmc.quilt-loader'
        | 'net.neoforge'
      version: string
    }>
    formatVersion: 1
  }
  cfg: {
    name: string
    notes: string
  }
}

/**
 * MCBBS modpack manifest format
 */
export interface McbbsModpackManifest extends ModpackManifest {
  manifestType: 'minecraftModpack'
  manifestVersion: 2
  description: string
  url: string
  fileApi?: string
  forceUpdate?: boolean
  origin?: {
    type: string
    id: number
  }[]
  addons: ModpackAddon[]
  libraries?: {
    name: string
    fileName: string
    hint: 'local'
  }[]
  files?: Array<ModpackFileInfoAddon | ModpackFileInfoCurseforge>
  settings?: {
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

/**
 * CurseForge modpack manifest format
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
  files?: {
    projectID: number
    fileID: number
    required: boolean
  }[]
  overrides: string
}

// Conversion functions from modpack manifests to instance configurations

/**
 * Convert MCBBS modpack manifest to instance configuration
 */
export function getInstanceConfigFromMcbbsModpack(manifest: McbbsModpackManifest) {
  return {
    name: `${manifest.name}-${manifest.version}`,
    author: manifest.author,
    url: manifest.url,
    description: manifest.description,
    runtime: {
      minecraft: manifest.addons.find((a) => a.id === 'game')?.version ?? '',
      forge: manifest.addons.find((a) => a.id === 'forge')?.version ?? '',
      liteloader: '',
      fabricLoader: manifest.addons.find((a) => a.id === 'fabric')?.version ?? '',
      yarn: '',
    },
    mcOptions: manifest.launchInfo ? manifest.launchInfo.launchArgument : undefined,
    vmOptions: manifest.launchInfo ? manifest.launchInfo.javaArgument : undefined,
    minMemory: manifest.launchInfo ? Number(manifest.launchInfo.minMemory) : undefined,
  }
}

/**
 * Convert MultiMC modpack manifest to instance configuration
 */
export function getInstanceConfigFromMmcModpack(manifest: MMCModpackManifest) {
  const forge = manifest.json.components.find((c) => c.uid === 'net.minecraftforge')
  const fabric = manifest.json.components.find((c) => c.uid === 'net.fabricmc.fabric-loader')
  const quilt = manifest.json.components.find((c) => c.uid === 'net.quiltmc.quilt-loader')
  const neoForge = manifest.json.components.find((c) => c.uid === 'net.neoforge')

  return {
    name: manifest.cfg.name,
    description: manifest.cfg.notes,
    runtime: {
      minecraft: manifest.json.components.find((c) => c.uid === 'net.minecraft')!.version,
      forge: forge ? forge.version : undefined,
      fabricLoader: fabric ? fabric.version : undefined,
      quiltLoader: quilt ? quilt.version : undefined,
      neoForged: neoForge ? neoForge.version : undefined,
    },
  }
}

/**
 * Convert CurseForge modpack manifest to instance configuration
 */
export function getInstanceConfigFromCurseforgeModpack(manifest: CurseforgeModpackManifest) {
  const forgeId = manifest.minecraft.modLoaders.find((l) => l.id.startsWith('forge'))
  const fabricId = manifest.minecraft.modLoaders.find((l) => l.id.startsWith('fabric'))
  const neoForgeId = manifest.minecraft.modLoaders.find((l) => l.id.startsWith('neoforge'))
  const quiltId = manifest.minecraft.modLoaders.find((l) => l.id.startsWith('quilt'))

  return {
    name: manifest.version ? `${manifest.name}-${manifest.version}` : manifest.name,
    author: manifest.author,
    runtime: {
      minecraft: manifest.minecraft.version,
      forge: forgeId ? forgeId.id.substring(6) : undefined,
      fabricLoader: fabricId ? fabricId.id.substring(7) : undefined,
      neoForged: neoForgeId ? neoForgeId.id.substring(9) : undefined,
      quiltLoader: quiltId ? quiltId.id.substring(6) : undefined,
    },
  }
}

/**
 * Convert Modrinth modpack manifest to instance configuration
 */
export function getInstanceConfigFromModrinthModpack(manifest: ModrinthModpackManifest) {
  return {
    name: manifest.versionId ? `${manifest.name}-${manifest.versionId}` : manifest.name,
    description: manifest.summary,
    runtime: {
      minecraft: manifest.dependencies.minecraft,
      forge: manifest.dependencies.forge,
      neoForged: manifest.dependencies.neoforge,
      fabricLoader: manifest.dependencies['fabric-loader'],
      quiltLoader: manifest.dependencies['quilt-loader'],
    },
  } satisfies CreateInstanceOptions
}

// Conversion functions from instance data to modpack manifests

/**
 * Convert instance data to Modrinth modpack manifest
 */
export function getModrinthModpackFromInstance(instance: InstanceData): ModrinthModpackManifest {
  return {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '',
    name: instance.name,
    summary: instance.description,
    dependencies: {
      minecraft: instance.runtime.minecraft,
      forge: instance.runtime.forge || undefined,
      'fabric-loader': instance.runtime.fabricLoader || undefined,
      'quilt-loader': instance.runtime.quiltLoader || undefined,
      neoforge: instance.runtime.neoForged || undefined,
    },
    files: [],
  }
}

/**
 * Convert instance data to CurseForge modpack manifest
 */
export function getCurseforgeModpackFromInstance(
  instance: InstanceData,
): CurseforgeModpackManifest {
  const modLoaders = [] as { id: string; primary: boolean }[]

  if (instance.runtime.forge) {
    modLoaders.push({
      id: `forge-${instance.runtime.forge}`,
      primary: true,
    })
  }
  if (instance.runtime.fabricLoader) {
    modLoaders.push({
      id: `fabric-${instance.runtime.fabricLoader}`,
      primary: true,
    })
  }
  if (instance.runtime.neoForged) {
    modLoaders.push({
      id: `neoforge-${instance.runtime.neoForged}`,
      primary: true,
    })
  }
  if (instance.runtime.quiltLoader) {
    modLoaders.push({
      id: `quilt-${instance.runtime.quiltLoader}`,
      primary: true,
    })
  }

  return {
    manifestType: 'minecraftModpack',
    manifestVersion: 1,
    minecraft: {
      version: instance.runtime.minecraft,
      modLoaders,
    },
    name: instance.name,
    version: '',
    author: instance.author,
    files: [],
    overrides: 'overrides',
  }
}

/**
 * Convert instance data to MCBBS modpack manifest
 */
export function getMcbbsModpackFromInstance(instance: InstanceData): McbbsModpackManifest {
  const mcbbsManifest: McbbsModpackManifest = {
    manifestType: 'minecraftModpack',
    manifestVersion: 2,
    description: instance.description,
    url: instance.url,
    name: instance.name,
    version: '',
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

export interface ModpackInstallProfile {
  instance: CreateInstanceOptions & { runtime: PartialRuntimeVersions }
  files: InstanceFile[]
}
