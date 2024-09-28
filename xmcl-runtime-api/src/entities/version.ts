import type { LibraryInfo, ResolvedLibrary, ResolvedVersion, Version } from '@xmcl/core'
import { parseVersion, VersionRange } from '../util/mavenVersion'
import { RuntimeVersions } from './instance.schema'

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

export interface MinecraftVersions {
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
   * All the versions in list
   * @default []
   */
  versions: MinecraftVersion[]
}

export interface NeoForgedVersions {
  latest: string
  release: string
  versions: string[]
}

export interface LiteloaderVersions {
  /**
   * @default ""
   */
  timestamp: string
  /**
   * @default {}
   */
  meta: {
    /**
     * @default ""
     */
    description: string
    /**
     * @default ""
     */
    authors: string
    /**
     * @default ""
     */
    url: string
    /**
     * @default ""
     */
    updated: string
    /**
     * @default ""
     */
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

export interface FabricArtifactVersion {
  gameVersion?: string
  separator?: string
  build?: number
  maven: string
  version: string
  stable: boolean
}

export interface FabricVersions {
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

export interface QuiltArtifactVersion {
  loader: {
    separator: string
    build: number
    /**
      * e.g. "org.quiltmc:quilt-loader:0.16.1",
      */
    version: string
    maven: string
  }
  hashed: {
    maven: string
    version: string
  }
  intermediary: {
    maven: string
    version: string
  }
  launcherMeta: {
    version: number
    min_java_version: number
    libraries: {
      client: LibraryInfo[]
      common: LibraryInfo[]
      server: LibraryInfo[]
      development: LibraryInfo[]
    }
    mainClass: {
      client: string
      server: string
      serverLauncher: string
    }
  }
}

export interface OptifineVersions {
  /**
     * @default []
     */
  versions: OptifineVersion[]
  /**
     * @default ""
     */
  etag: string
}

export interface QuiltVersions {
  /**
    * @default []
    */
  versions: QuiltArtifactVersion[]
  /**
    * @default ""
    */
  timestamp: string
}

export type Status = 'remote' | 'local' | 'loading'
export interface PartialVersionResolver {
  (version: Version): string
}

export const resolveForgeVersion: PartialVersionResolver = (v) => filterForgeVersion(v.libraries.find(l => l.name.startsWith('net.minecraftforge:forge:'))
  ?.name.split(':')[2]?.split('-')?.[1] || '')

export const resolveLiteloaderVersion: PartialVersionResolver = (v) => v.libraries.find(l => l.name.startsWith('com.mumfrey:liteloader:'))
  ?.name.split(':')[2] || ''

export const resolveFabricLoaderVersion: PartialVersionResolver = (v) => v.libraries.find(l => l.name.startsWith('net.fabricmc:fabric-loader:'))
  ?.name.split(':')[2] || ''

export const resolveFabricYarnVersion: PartialVersionResolver = (v) => v.libraries.find(l => l.name.startsWith('net.fabricmc:yarn:'))
  ?.name.split(':')[2] || ''

export const resolveMinecraftVersion: PartialVersionResolver = (v) => (v.inheritsFrom ? '' : v.id)

export const resolveQuiltVersion: PartialVersionResolver = (v) => v.libraries.find(l => l.name.startsWith('org.quiltmc:quilt-loader:'))
  ?.name.split(':')[2] || ''

export function isForgeLibrary(lib: LibraryInfo) {
  return lib.groupId === 'net.minecraftforge' && (lib.artifactId === 'forge' || lib.artifactId === 'fmlloader' || lib.artifactId === 'minecraftforge')
}

export function isFabricLoaderLibrary(lib: LibraryInfo) {
  return lib.groupId === 'net.fabricmc' && lib.artifactId === 'fabric-loader'
}
export function isOptifineLibrary(lib: LibraryInfo) {
  return lib.groupId === 'optifine' && (lib.artifactId === 'Optifine' || lib.artifactId === 'OptiFine')
}

export function isQuiltLibrary(lib: LibraryInfo) {
  return lib.groupId === 'org.quiltmc' && lib.artifactId === 'quilt-loader'
}

export function findNeoForgedVersion(minecraft: string, resolvedVersion: { libraries: LibraryInfo[]; arguments: ResolvedVersion['arguments'] }) {
  const hasNeoForged = resolvedVersion.libraries.some(lib => lib.groupId === 'net.neoforged.fancymodloader')
  if (!hasNeoForged) return ''
  const forgeIndex = resolvedVersion.arguments.game.indexOf('--fml.forgeVersion')
  const neoForgeIndex = resolvedVersion.arguments.game.indexOf('--fml.neoForgeVersion')
  if (forgeIndex !== -1) {
    const version = resolvedVersion.arguments.game[forgeIndex + 1]
    return `${minecraft}-${version}` as string
  }
  if (neoForgeIndex !== -1) {
    const version = resolvedVersion.arguments.game[neoForgeIndex + 1]
    return version as string
  }
  return ''
}

export function findLabyModVersion(resolvedVersion: ResolvedVersion) {
  return resolvedVersion.libraries.find(l => l.groupId === 'net.labymod' && l.artifactId === 'LabyMod')?.version || ''
}

export function filterForgeVersion(forgeVersion: string) {
  if (!forgeVersion) return forgeVersion
  const idx = forgeVersion.indexOf('-')
  return forgeVersion.substring(idx + 1)
}
export function filterOptifineVersion(optifineVersion: string) {
  if (!optifineVersion) return optifineVersion
  const idx = optifineVersion.indexOf('_')
  return optifineVersion.substring(idx + 1)
}

export const EMPTY_VERSION: VersionHeader = Object.freeze({
  id: '',
  inheritances: [],
  path: '',
  minecraft: '',
  forge: '',
  fabric: '',
  liteloader: '',
  quilt: '',
  neoForged: '',
  labyMod: '',
  optifine: '',
})
export interface LibrariesRecord {
  org: string
  name: string
  version: string
}

export function resolveRuntimeVersion(partialVersion: Version, runtime: RuntimeVersions) {
  const minecraft = resolveMinecraftVersion(partialVersion)
  const forge = resolveForgeVersion(partialVersion)
  const liteloader = resolveLiteloaderVersion(partialVersion)
  const fabricLoader = resolveFabricLoaderVersion(partialVersion)
  const yarn = resolveFabricYarnVersion(partialVersion)
  const quilt = resolveQuiltVersion(partialVersion)

  runtime.minecraft = runtime.minecraft || minecraft
  runtime.forge = forge || runtime.forge
  runtime.liteloader = liteloader || runtime.liteloader
  runtime.fabricLoader = fabricLoader || runtime.fabricLoader
  runtime.yarn = yarn || runtime.yarn
  runtime.quiltLoader = quilt || runtime.quiltLoader
}

export function isCompatible(range: string, version: string) {
  if (range === '[*]') return true
  const vRange = VersionRange.createFromVersionSpec(range)
  return vRange?.containsVersion(parseVersion(version)) || false
}

export function getExpectVersion({ minecraft, forge, liteloader, fabricLoader: fabric, optifine, quiltLoader, neoForged, labyMod }: RuntimeVersions) {
  let expectedId = minecraft
  if (typeof forge === 'string' && forge.length > 0) expectedId += `-forge${forge}`
  if (typeof liteloader === 'string' && liteloader.length > 0) expectedId += `-liteloader${liteloader}`
  if (typeof fabric === 'string' && fabric.length > 0) expectedId += `-fabric${fabric}`
  if (typeof optifine === 'string' && optifine.length > 0) expectedId += `-optifine_${optifine}`
  if (typeof quiltLoader === 'string' && quiltLoader.length > 0) expectedId += `-quilt${quiltLoader}`
  if (typeof neoForged === 'string' && neoForged.length > 0) expectedId += `-neoforged${neoForged}`
  if (typeof labyMod === 'string' && labyMod.length > 0) expectedId += `-labymod${labyMod}`
  return expectedId
}
export function parseOptifineVersion(version: string): { type: string; patch: string } {
  const index = version.lastIndexOf('_')
  const type = version.substring(0, index)
  const patch = version.substring(index + 1)
  return { type, patch }
}

export function isReleaseVersion(version: string) {
  return version.match(/^[0-9]+\.[0-9]+(\.[0-9]+)?$/g)
}
export function isSnapshotPreview(version: string) {
  return version.match(/^[0-9]+\.[0-9]+((\.[0-9])?-pre[0-9]+)?$/g) ||
    version.match(/^[0-9]+\.[0-9]+(\.[0-9])? Pre-Release [0-9]+$/g) ||
    version.match(/^[0-9]+w[0-9]+[abcd]$/)
}
export function isBetaVersion(version: string) {
  return version.match(/^b[0-9]+\.[0-9]+(\.[0-9])?(_[0-9]+)?$/g)
}
export function isAlphaVersion(version: string) {
  return version.match(/^a[0-9]+\.[0-9]+(\.[0-9])?(_[0-9]+)?$/g)
}
export function isSameForgeVersion(forgeVersion: string, version: string, minecraft: string) {
  if (version.startsWith(`${minecraft}-`)) version = version.substring(`${minecraft}-`.length)
  if (version.endsWith(`-${minecraft}`)) version = version.substring(0, version.length - `-${minecraft}`.length)
  const i = version.indexOf('-')
  if (i === -1) {
    return forgeVersion === version
  }
  return forgeVersion === version.substring(i + 1) || forgeVersion === version.substring(0, i)
}
export function isSameOptifineVersion(optifineVersion: string, version: string) {
  const i = version.indexOf('_')
  if (i === -1) {
    return optifineVersion === version
  }
  return optifineVersion === version.substring(i + 1)
}

function isVersionMatched(version: VersionHeader,
  minecraft: string | undefined,
  forge: string | undefined,
  neoForged: string | undefined,
  fabricLoader: string | undefined,
  optifine: string | undefined,
  quiltLoader: string | undefined,
  labyMod: string | undefined,
) {
  // compute version
  if (version.minecraft !== minecraft) {
    return false
  }
  if (forge) {
    // require forge
    if (!version.forge || !isSameForgeVersion(forge, version.forge, minecraft)) {
      // require forge but not forge
      return false
    }
  } else if (version.forge) {
    return false
  }

  if (neoForged) {
    console.log(version.neoForged)
    // require neoForged
    if (!version.neoForged || version.neoForged !== neoForged) {
      // require neoForged but not neoForged
      return false
    }
  } else if (version.neoForged) {
    return false
  }

  if (labyMod) {
    // require labyMod
    if (!version.labyMod || version.labyMod !== labyMod) {
      return false
    }
  } else if (version.labyMod) {
    return false
  }

  if (fabricLoader) {
    // require fabric
    if (!version.fabric || version.fabric !== fabricLoader) {
      return false
    }
  } else if (version.fabric) {
    return false
  }

  if (optifine) {
    // require optifine
    if (!version.optifine || (optifine !== version.optifine)) {
      return false
    }
  } else if (version.optifine) {
    return false
  }

  if (quiltLoader) {
    // require quilt
    if (!version.quilt || version.quilt !== quiltLoader) {
      return false
    }
  } else if (version.quilt) {
    return false
  }

  return true
}

export function findMatchedVersion(versions: VersionHeader[], id: string,
  minecraft: string | undefined,
  forge: string | undefined,
  neoForged: string | undefined,
  fabricLoader: string | undefined,
  optifine: string | undefined,
  quiltLoader: string | undefined,
  labyMod: string | undefined,
): VersionHeader | undefined {
  return versions.find(v => v.id === id) || versions.find(ver => isVersionMatched(ver, minecraft, forge, neoForged, fabricLoader, optifine, quiltLoader, labyMod))
}

export function getMinecraftVersionFormat(version: string): 'release' | 'snapshot' | 'beta' | 'alpha' | 'unknown' {
  return isReleaseVersion(version)
    ? 'release'
    : isSnapshotPreview(version)
      ? 'snapshot'
      : isBetaVersion(version)
        ? 'beta'
        : isAlphaVersion(version)
          ? 'alpha'
          : 'unknown'
}

export function getResolvedVersionHeader(ver: ResolvedVersion): VersionHeader {
  return {
    id: ver.id,
    path: ver.pathChain[0],
    inheritances: ver.inheritances,
    minecraft: ver.minecraftVersion,
    neoForged: findNeoForgedVersion(ver.minecraftVersion, ver),
    forge: filterForgeVersion(ver.libraries.find(isForgeLibrary)?.version ?? ''),
    fabric: ver.libraries.find(isFabricLoaderLibrary)?.version ?? '',
    optifine: filterOptifineVersion(ver.libraries.find(isOptifineLibrary)?.version ?? ''),
    quilt: ver.libraries.find(isQuiltLibrary)?.version ?? '',
    labyMod: findLabyModVersion(ver),
    liteloader: '',
  }
}

export function compareRelease(versionA: string, versionB: string): number {
  const [major, minor, patch] = versionA.split('.').map(s => Number.parseInt(s, 10))
  const [majorB, minorB, patchB] = versionB.split('.').map(s => Number.parseInt(s, 10))
  if (major === majorB) {
    if (minor === minorB) {
      if (patch === patchB) {
        return 0
      }
      return patch - patchB
    }
    return minor - minorB
  }
  return major - majorB
}

export function compareSnapshot(versionA: string, versionB: string) {
  const [majorA, restA] = versionA.split('w')
  const [majorB, restB] = versionB.split('w')

  if (majorA === majorB) {
    const minorA = Number.parseInt(restA.slice(0, 2), 10)
    const minorB = Number.parseInt(restB.slice(0, 2), 10)
    if (minorA === minorB) {
      const codeA = restA.slice(2, 3)
      const codeB = restA.slice(2, 3)
      return codeA.localeCompare(codeB)
    }
    return minorA - minorB
  }
  return Number.parseInt(majorA, 10) - Number.parseInt(majorB, 10)
}

export const LATEST_RELEASE = { id: '1.18.1', type: 'release', url: 'https://launchermeta.mojang.com/v1/packages/6ad09383ac77f75147c38be806961099c02c1ef9/1.18.1.json', time: '2022-01-19T15:56:14+00:00', releaseTime: '2021-12-10T08:23:00+00:00' }

export interface VersionHeader {
  path: string
  id: string
  inheritances: string[]
  /**
   * Minecraft version of this version. e.g. 1.7.10
   * @default ""
   */
  minecraft: string
  /**
   * Forge version of this version. e.g. 14.23.5.2838
   * @default ""
   */
  forge: string
  /**
   * Fabric loader version, e.g. 0.7.2+build.175
   * @default ""
   */
  fabric: string
  /**
   * Optifine version e.g. HD_U_F1_pre6 or HD_U_E6
   * @default ""
   */
  optifine: string
  /**
   * NeoForged version of this version. e.g. 47.0.1
   */
  neoForged: string
  liteloader: string
  quilt: string

  labyMod: string
}

export type ServerVersionHeader = {
  id: string
  minecraft: string
  type: 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge'
  version?: string
}
export interface ResolvedServerVersion {
  id: string
  libraries: ResolvedLibrary[]
  mainClass: string
  jar?: string
  minecraftVersion: string
  arguments: {
    game: string[]
    jvm: string[]
  }
}

export class LocalVersions {
  /**
   * All the local versions installed in the disk
   */
  local = [] as VersionHeader[]

  servers = [] as ServerVersionHeader[]

  localVersions(local: VersionHeader[]) {
    local.forEach(Object.freeze)
    this.local = local
  }

  localVersionAdd(local: VersionHeader) {
    Object.freeze(local)
    const found = this.local.findIndex(l => l.id === local.id)
    if (found !== -1) {
      this.local[found] = local
    } else {
      this.local.push(local as any)
      this.local = this.local.sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  localVersionRemove(folder: string) {
    this.local = this.local.filter(v => v.id !== folder)
  }

  serverProfileAdd(profile: ServerVersionHeader) {
    this.servers.push(profile)
  }

  serverProfileRemove(id: string) {
    this.servers = this.servers.filter(p => p.id !== id)
  }
}
