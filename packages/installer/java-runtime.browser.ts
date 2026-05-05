import { getPlatform, Platform } from '@xmcl/core'
import { doFetch, FetchOptions } from './utils.browser'

/**
 * Contain all java runtimes basic info
 */
export interface JavaRuntimes {
  linux: JavaRuntimeTargets
  'linux-i386': JavaRuntimeTargets
  'mac-os': JavaRuntimeTargets
  'mac-os-arm64': JavaRuntimeTargets
  'windows-x64': JavaRuntimeTargets
  'windows-x86': JavaRuntimeTargets
  'windows-arm64': JavaRuntimeTargets
}

export interface JavaRuntimeTargets {
  'java-runtime-alpha': JavaRuntimeTarget[]
  'java-runtime-beta': JavaRuntimeTarget[]
  'jre-legacy': JavaRuntimeTarget[]
  'minecraft-java-exe': JavaRuntimeTarget[]
  [key: string]: JavaRuntimeTarget[]
}

export enum JavaRuntimeTargetType {
  /**
   * The legacy java version
   */
  Legacy = 'jre-legacy',
  /**
   * The new java environment, which is the java 16
   */
  Alpha = 'java-runtime-alpha',
  Beta = 'java-runtime-beta',
  Delta = 'java-runtime-delta',
  Gamma = 'java-runtime-gamma',
  JavaExe = 'minecraft-java-exe',
}

/**
 * Represent a java runtime
 */
export interface JavaRuntimeTarget {
  /**
   * Guessing this is the flight of this java runtime
   */
  availability: {
    group: number
    progress: number
  }
  /**
   * The manifest detail of the resource
   */
  manifest: DownloadInfo
  /**
   * The basic version info of the manifest
   */
  version: {
    /**
     * The name of the version. e.g. `8u51`, `12`, `16.0.1.9.1`
     */
    name: string
    /**
     * The date string (UTC)
     */
    released: string
  }
}

export interface Entry {
  type: 'file' | 'link' | 'directory'
}

export interface LinkEntry extends Entry {
  type: 'link'
  /**
   * The link target
   */
  target: string
}

export interface DirectoryEntry extends Entry {
  type: 'directory'
}

export interface DownloadInfo {
  /**
   * The sha info of the resource
   */
  sha1: string
  /**
   * The size of the resource
   */
  size: number
  /**
   * The url to download resource
   */
  url: string
}

export interface FileEntry extends Entry {
  type: 'file'
  executable: boolean
  downloads: {
    /**
     * The raw format of the file
     */
    raw: DownloadInfo
    /**
     * The lzma format of the file
     */
    lzma?: DownloadInfo
  }
}

export type JreRuntimeEntry = FileEntry | DirectoryEntry | LinkEntry

/**
 * Contains info about every files in this java runtime
 */
export interface JavaRuntimeManifest {
  target: JavaRuntimeTargetType | string
  /**
   * The files of the java runtime
   */
  files: Record<string, JreRuntimeEntry>

  version: JavaRuntimeTarget['version']
}

export const DEFAULT_RUNTIME_ALL_URL =
  'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

function normalizeUrls(url: string, fileHost?: string | string[]): string[] {
  if (!fileHost) {
    return [url]
  }
  if (typeof fileHost === 'string') {
    const u = new URL(url)
    u.hostname = fileHost
    const result = u.toString()
    if (result !== url) {
      return [result, url]
    }
    return [result]
  }
  const result = fileHost.map((host) => {
    const u = new URL(url)
    u.hostname = host
    return u.toString()
  })

  if (result.indexOf(url) === -1) {
    result.push(url)
  }

  return result
}

export interface FetchJavaRuntimeManifestOptions extends FetchOptions {
  /**
   * The alternative download host for the file
   */
  apiHost?: string | string[]
  /**
   * The url of the all runtime json
   */
  url?: string
  /**
   * The platform to install. It will be auto-resolved by default.
   * @default getPlatform()
   */
  platform?: Platform
  /**
   * The install java runtime type
   * @default InstallJavaRuntimeTarget.Next
   */
  target?: JavaRuntimeTargetType | string
  /**
   * The index manifest of the java runtime. If this is not presented, it will fetch by platform and all platform url.
   */
  manifestIndex?: JavaRuntimes
}

/**
 * Fetch java runtime manifest. It should be able to resolve to your platform, or you can assign the platform.
 *
 * Also, you should assign the target to download, or it will use the latest java 16.
 * @param options The options of fetch runtime manifest
 */
export async function fetchJavaRuntimeManifest(
  options: FetchJavaRuntimeManifestOptions = {},
): Promise<JavaRuntimeManifest> {
  let manifestIndex = options.manifestIndex
  if (!manifestIndex) {
    const response = await doFetch(
      options,
      normalizeUrls(options.url ?? DEFAULT_RUNTIME_ALL_URL, options.apiHost)[0],
    )
    manifestIndex = (await response.json()) as JavaRuntimes
  }
  const manifest = manifestIndex
  const platform = options.platform ?? getPlatform()
  const runtimeTarget = options.target ?? JavaRuntimeTargetType.Beta
  const resolveTarget = () => {
    if (platform.name === 'windows') {
      if (platform.arch === 'x64') {
        return manifest['windows-x64']
      }
      if (platform.arch === 'x86' || platform.arch === 'x32') {
        return manifest['windows-x86']
      }
      if (platform.arch === 'arm64') {
        return manifest['windows-arm64']
      }
      return manifest['windows-x64']
    }
    if (platform.name === 'osx') {
      if (platform.arch === 'arm64') {
        return manifest['mac-os-arm64']
      }
      return manifest['mac-os']
    }
    if (platform.name === 'linux') {
      if (platform.arch === 'x86' || platform.arch === 'x32') {
        return manifest['linux-i386']
      }
      if (platform.arch === 'x64') {
        return manifest.linux
      }
      return manifest.linux
    }
    throw new Error('Cannot resolve platform')
  }
  const targets = resolveTarget()[runtimeTarget]
  if (targets && targets.length > 0) {
    const target = targets[0]
    const manifestUrl = normalizeUrls(target.manifest.url, options.apiHost)[0]
    const response = await doFetch(options, manifestUrl)
    const manifest: JavaRuntimeManifest = (await response.json()) as any
    const result: JavaRuntimeManifest = {
      files: manifest.files,
      target: runtimeTarget,
      version: target.version,
    }
    return result
  } else {
    throw new Error()
  }
}
