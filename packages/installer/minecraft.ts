/* eslint-disable n/no-unsupported-features/node-builtins */
import {
  isBadVersionJsonError,
  isCorruptedVersionJsonError,
  isMissingVersionJsonError,
  MinecraftFolder,
  MinecraftLocation,
  ResolvedVersion,
  Version,
  Version as VersionJson,
} from '@xmcl/core'
import { writeFile } from 'fs/promises'
import { join, relative, sep } from 'path'
import { diagnoseFile } from './diagnose'
import { InstallError } from './error'
import { type InstallFile } from './installManifest'
import { MinecraftVersionBaseInfo } from './minecraft.browser'
import { onDownloadMultiple, Tracker, WithDownload } from './tracker'
import { WithDiagnose } from './utils'
import { resolveDownloadUrls } from './utils.browser'

export interface MinecraftTrackerEvents {
  'version.json': WithDownload<{ id: string; url: string }>
  'version.jar': WithDownload<{
    id: string
    side: 'client' | 'server'
    size: number
    sha1?: string
  }>
}

export { DEFAULT_VERSION_MANIFEST_URL, getVersionList } from './minecraft.browser'
export type {
  MinecraftVersion,
  MinecraftVersionBaseInfo,
  MinecraftVersionList
} from './minecraft.browser'

/**
 * Replace the minecraft client or server jar download
 */
export interface JarOption extends InstallSideOption, WithDiagnose {
  /**
   * Whether to install the Minecraft jar after resolving the version JSON.
   * @default true
   */
  installJar?: boolean
  /**
   * The version json url replacement
   */
  json?: string | string[] | ((version: MinecraftVersionBaseInfo) => string | string[])
  /**
   * The client jar url replacement
   */
  client?: string | string[] | ((version: ResolvedVersion) => string | string[])
  /**
   * The server jar url replacement
   */
  server?: string | string[] | ((version: ResolvedVersion) => string | string[])
  /**
   * The tracker to track the install process
   */
  tracker?: Tracker<MinecraftTrackerEvents>
  /**
   * Custom checksum function for file validation
   */
  checksum?: (file: string, algorithm: string) => Promise<string>

  signal?: AbortSignal
}

export interface InstallSideOption {
  /**
   * The installation side
   */
  side?: 'client' | 'server'
}

export function resolveMinecraftJarInstallFile(
  version: ResolvedVersion,
  options: JarOption = {},
): InstallFile | undefined {
  const side = options.side ?? 'client'
  const downloadInfo = version.downloads[side]
  if (!downloadInfo) return undefined
  const folder = MinecraftFolder.from(version.minecraftDirectory)
  return {
    path: folder.getVersionJar(version.minecraftVersion, side),
    urls: resolveDownloadUrls(downloadInfo.url, version, options[side]),
    size: downloadInfo.size,
    checksum: downloadInfo.sha1
      ? { algorithm: 'sha1', value: downloadInfo.sha1 }
      : undefined,
    validator: 'zip',
    validatedAt: options.timestamp,
  }
}

export function resolveMinecraftVersionJsonInstallFile(
  version: MinecraftVersionBaseInfo,
  minecraft: MinecraftLocation,
  options: JarOption = {},
): InstallFile {
  const folder = MinecraftFolder.from(minecraft)
  return {
    path: folder.getVersionJson(version.id),
    urls: resolveDownloadUrls(version.url, version, options.json),
    validator: 'json',
    replace: true,
  }
}
