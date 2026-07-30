import type { Version } from '@xmcl/core'
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
 * A single component patch as stored under `patches/<uid>.json` in a Prism /
 * MultiMC export. See https://github.com/MultiMC/Launcher/wiki/Instance-File-Format.
 *
 * Only the fields xmcl currently consumes are typed; the rest are passed through.
 */
export interface MMCComponentPatch {
  formatVersion?: number
  name?: string
  uid: string
  version?: string
  order?: number
  mainClass?: string
  appletClass?: string
  minecraftArguments?: string
  /** Additive JVM args merged on top of the parent component. */
  '+jvmArgs'?: string[]
  /** Additive tweaker class names (legacy Forge). */
  '+tweakers'?: string[]
  /** Additive traits. */
  '+traits'?: string[]
  libraries?: Array<{
    name: string
    url?: string
    /** `"local"` means the jar is bundled inside the modpack zip. */
    'MMC-hint'?: string
    [key: string]: any
  }>
  [key: string]: any
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
        | string
      version?: string
    }>
    formatVersion: 1
  }
  cfg: {
    name: string
    notes: string
    /** See gh #1386 — only honored when `OverrideCommands === 'true'`. */
    OverrideCommands?: string
    PreLaunchCommand?: string
    WrapperCommand?: string
    PostExitCommand?: string
    JvmArgs?: string
    MinMemAlloc?: string
    MaxMemAlloc?: string
    // Other instance.cfg keys are passed through but not strongly typed.
    [key: string]: string | undefined
  }
  /**
   * Prism Launcher and some MultiMC exports nest the instance under a top-level
   * folder named after the instance (e.g. `GT New Horizons 2.8.4/mmc-pack.json`).
   * When present, this prefix (with trailing `/`) is stripped from every entry
   * path before unpacking.
   */
  prefix?: string
  /**
   * Optional component patches read from `patches/<uid>.json`. The map key is
   * the component `uid`. Used to merge `+jvmArgs` / `+tweakers` overrides that
   * Prism Launcher stores out-of-line.
   */
  patches?: Record<string, MMCComponentPatch>
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

  const result: {
    name: string
    description: string
    runtime: {
      minecraft: string
      forge?: string
      fabricLoader?: string
      quiltLoader?: string
      neoForged?: string
    }
    vmOptions?: string[]
    mcOptions?: string[]
    minMemory?: number
    maxMemory?: number
    preExecuteCommand?: string
    prependCommand?: string
  } = {
    name: manifest.cfg.name,
    description: manifest.cfg.notes,
    runtime: {
      minecraft: manifest.json.components.find((c) => c.uid === 'net.minecraft')!.version ?? '',
      forge: forge ? forge.version : undefined,
      fabricLoader: fabric ? fabric.version : undefined,
      quiltLoader: quilt ? quilt.version : undefined,
      neoForged: neoForge ? neoForge.version : undefined,
    },
  }

  // Merge component patches (Prism stores `+jvmArgs` / `+tweakers` out-of-line
  // under `patches/<uid>.json`). Iterate in `mmc-pack.json` component order so
  // overrides apply in a deterministic sequence.
  const vmArgs: string[] = []
  const tweakers: string[] = []
  if (manifest.patches) {
    for (const comp of manifest.json.components) {
      const patch = manifest.patches[comp.uid]
      if (!patch) continue
      if (patch['+jvmArgs']?.length) vmArgs.push(...patch['+jvmArgs'])
      if (patch['+tweakers']?.length) tweakers.push(...patch['+tweakers'])
    }
  }

  if (manifest.cfg.JvmArgs) {
    vmArgs.unshift(...manifest.cfg.JvmArgs.split(' ').filter(v => !!v))
  }
  if (vmArgs.length) {
    result.vmOptions = vmArgs
  }
  if (tweakers.length) {
    // Forge legacy launches use `--tweakClass <name>` per tweaker.
    result.mcOptions = tweakers.flatMap((t) => ['--tweakClass', t])
  }

  const minMem = manifest.cfg.MinMemAlloc ? parseInt(manifest.cfg.MinMemAlloc, 10) : NaN
  if (!Number.isNaN(minMem) && minMem > 0) {
    result.minMemory = minMem
  }
  const maxMem = manifest.cfg.MaxMemAlloc ? parseInt(manifest.cfg.MaxMemAlloc, 10) : NaN
  if (!Number.isNaN(maxMem) && maxMem > 0) {
    result.maxMemory = maxMem
  }

  // gh #1386 — Import per-instance commands when OverrideCommands is enabled.
  // PostExitCommand has no xmcl equivalent and is intentionally dropped.
  if (manifest.cfg.OverrideCommands === 'true') {
    if (manifest.cfg.PreLaunchCommand) {
      result.preExecuteCommand = manifest.cfg.PreLaunchCommand
    }
    if (manifest.cfg.WrapperCommand) {
      result.prependCommand = manifest.cfg.WrapperCommand
    }
  }

  return result
}

/**
 * The set of Minecraft version-JSON fields that a Prism / MultiMC component
 * patch can override. Merging every `patches/<uid>.json` file (in `order`)
 * yields a standalone Minecraft version JSON — this is how Prism itself resolves
 * the launch configuration.
 *
 * The result carries the merged `mainClass`, `libraries` (including the
 * `MMC-hint: "local"` jars bundled under `libraries/` in the modpack) and the
 * base metadata (`assetIndex`, `arguments`, ...). Writing it to
 * `versions/<id>/<id>.json` and pinning the instance's `version` to `<id>` lets
 * xmcl launch the merged result without regenerating the Forge `version.json`
 * (which would otherwise reset `mainClass` and drop the extra libraries — see
 * gh #1555 / GTNH 2.8.4).
 *
 * Returns `undefined` when the patches do not override the launch behaviour
 * (no `mainClass` override, or not enough base data to form a launchable
 * standalone version). In that case the caller should keep the normal
 * runtime-based install path untouched.
 */
export function getMmcVersionFromManifest(
  manifest: MMCModpackManifest,
  id: string,
): Version | undefined {
  const patches = manifest.patches
  if (!patches) return undefined
  const components = manifest.json?.components
  if (!Array.isArray(components) || components.length === 0) return undefined

  // Only consider components declared in mmc-pack.json (defensive against stale
  // patch files) and order them by their patch `order`, falling back to the
  // declaration order for ties / missing `order`.
  const ordered = components
    .map((component, index) => ({ index, patch: patches[component.uid] }))
    .filter((entry): entry is { index: number; patch: MMCComponentPatch } => !!entry.patch)
    .sort((a, b) => {
      const ao = typeof a.patch.order === 'number' ? a.patch.order : a.index
      const bo = typeof b.patch.order === 'number' ? b.patch.order : b.index
      return ao !== bo ? ao - bo : a.index - b.index
    })

  if (ordered.length === 0) return undefined

  let mainClass = ''
  let minecraftArguments: string | undefined
  let assetIndex: Version['assetIndex']
  let assets: string | undefined
  let type: string | undefined
  let jar: string | undefined
  let javaVersion: Version['javaVersion']
  let downloads: Version['downloads']
  let time: string | undefined
  let releaseTime: string | undefined
  let minimumLauncherVersion: number | undefined
  const gameArgs: Version.LaunchArgument[] = []
  const jvmArgs: Version.LaunchArgument[] = []
  const libraries: Version.Library[] = []
  let hasLibraries = false

  for (const { patch } of ordered) {
    // Scalars: the last component (highest `order`) wins.
    if (patch.mainClass) mainClass = patch.mainClass
    if (typeof patch.minecraftArguments === 'string') minecraftArguments = patch.minecraftArguments
    if (patch.assetIndex) assetIndex = patch.assetIndex
    if (typeof patch.assets === 'string') assets = patch.assets
    if (typeof patch.type === 'string') type = patch.type
    if (typeof patch.jar === 'string') jar = patch.jar
    if (patch.javaVersion) javaVersion = patch.javaVersion
    if (patch.downloads) downloads = patch.downloads
    if (typeof patch.time === 'string') time = patch.time
    if (typeof patch.releaseTime === 'string') releaseTime = patch.releaseTime
    if (typeof patch.minimumLauncherVersion === 'number') {
      minimumLauncherVersion = patch.minimumLauncherVersion
    }

    // Modern (1.13+) argument arrays are additive across components.
    if (patch.arguments) {
      if (Array.isArray(patch.arguments.game)) gameArgs.push(...patch.arguments.game)
      if (Array.isArray(patch.arguments.jvm)) jvmArgs.push(...patch.arguments.jvm)
    }

    // Libraries accumulate in component order so earlier components appear first
    // on the classpath, matching Prism / MultiMC. `+libraries` is the additive
    // form used by some patches.
    const patchLibraries = [
      ...(Array.isArray(patch.libraries) ? patch.libraries : []),
      ...(Array.isArray(patch['+libraries']) ? patch['+libraries'] : []),
    ] as Version.Library[]
    if (patchLibraries.length) {
      hasLibraries = true
      libraries.push(...patchLibraries)
    }
  }

  // Only take over the launch configuration when the patches actually override
  // `mainClass` AND provide the base version data (libraries + a game-argument
  // source). Anything less is not a launchable standalone version, so fall back
  // to the runtime-based install path.
  const hasGameArgs = !!minecraftArguments || gameArgs.length > 0 || !!assetIndex
  if (!mainClass || !hasLibraries || !hasGameArgs) {
    return undefined
  }

  const version = {
    id,
    type: type || 'release',
    time: time || '1970-01-01T00:00:00+00:00',
    releaseTime: releaseTime || '1970-01-01T00:00:00+00:00',
    minimumLauncherVersion: minimumLauncherVersion ?? 0,
    mainClass,
    libraries,
  } as Version

  if (jar) version.jar = jar
  if (assetIndex) version.assetIndex = assetIndex
  if (assets) version.assets = assets
  if (downloads) version.downloads = downloads
  if (javaVersion) version.javaVersion = javaVersion
  if (minecraftArguments) version.minecraftArguments = minecraftArguments
  if (gameArgs.length || jvmArgs.length) {
    version.arguments = { game: gameArgs, jvm: jvmArgs }
  }

  return version
}

/**
 * Collect the maven coordinates of the `MMC-hint: "local"` libraries declared by
 * a merged Prism / MultiMC version. These jars are bundled inside the modpack
 * (under `libraries/`) instead of being downloadable, so the importer must copy
 * them into the shared `libraries/` folder by their maven path.
 */
export function getMmcLocalLibraryNames(version: Version): string[] {
  const names: string[] = []
  if (!Array.isArray(version.libraries)) return names
  for (const lib of version.libraries) {
    const hint = (lib as Version.Library & { 'MMC-hint'?: string })?.['MMC-hint']
    if (hint === 'local' && typeof lib?.name === 'string') {
      names.push(lib.name)
    }
  }
  return names
}

/**
 * Convert CurseForge modpack manifest to instance configuration
 */
export function getInstanceConfigFromCurseforgeModpack(manifest: CurseforgeModpackManifest) {
  // Some user-authored modpacks omit the `minecraft` block (only contains
  // `manifestType:"minecraftModpack"` plus `files`). Surface a typed error
  // instead of a generic `Cannot read properties of undefined (reading
  // 'modLoaders')` (telemetry bucket: `Object.getInstanceConfigFromCurseforgeModpack`).
  const minecraft = manifest.minecraft
  if (!minecraft || !Array.isArray(minecraft.modLoaders)) {
    const err = new Error('Curseforge modpack manifest missing minecraft.modLoaders')
    err.name = 'InvalidCurseforgeModpackManifestError'
    throw err
  }
  const forgeId = minecraft.modLoaders.find((l) => l.id?.startsWith('forge'))
  const fabricId = minecraft.modLoaders.find((l) => l.id?.startsWith('fabric'))
  const neoForgeId = minecraft.modLoaders.find((l) => l.id?.startsWith('neoforge'))
  const quiltId = minecraft.modLoaders.find((l) => l.id?.startsWith('quilt'))

  return {
    name: manifest.version ? `${manifest.name}-${manifest.version}` : manifest.name,
    author: manifest.author,
    runtime: {
      minecraft: minecraft.version,
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
