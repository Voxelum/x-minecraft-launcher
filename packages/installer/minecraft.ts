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
import { download, DownloadBaseOptions, getDownloadBaseOptions } from '@xmcl/file-transfer'
import { writeFile } from 'fs/promises'
import { join, relative, sep } from 'path'
import { diagnoseFile } from './diagnose'
import { InstallError } from './error'
import { MinecraftVersionBaseInfo } from './minecraft.browser'
import { onDownloadSingle, Tracker, WithDownload } from './tracker'
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
export interface JarOption extends DownloadBaseOptions, InstallSideOption, WithDiagnose {
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

export async function installMinecraftJar(
  version: ResolvedVersion,
  options: JarOption = {},
): Promise<void> {
  const folder = MinecraftFolder.from(version.minecraftDirectory)
  const side = options.side ?? 'client'
  if (version.downloads[side]) {
    // Download jar
    const jarDestination = folder.getVersionJar(version.minecraftVersion, side)
    const downloadInfo = version.downloads[side]!
    const jarUrls = resolveDownloadUrls(downloadInfo.url, version, options[side])

    await diagnoseFile(
      {
        file: jarDestination,
        expectedChecksum: downloadInfo.sha1,
        role: 'minecraftJar',
        hint: 'Problem on minecraft jar! Please consider to use Installer.installVersion to fix.',
      },
      { signal: options.signal, checksum: options.checksum },
    ).then((issue) => {
      if (!issue) {
        return
      }
      if (options.diagnose) {
        throw new InstallError({
          jar: version.id,
        })
      }
      return download({
        url: jarUrls,
        destination: jarDestination,
        ...getDownloadBaseOptions(options),
        tracker: onDownloadSingle(options.tracker, 'version.jar', {
          id: version.id,
          side,
          size: downloadInfo.size,
          sha1: downloadInfo.sha1,
        }),
        expectedTotal: downloadInfo.size,
        signal: options.signal,
      })
    })
  }
}

/**
 * Only install the json/jar. Do not install dependencies.
 *
 * @param versionMeta the version metadata; get from updateVersionMeta
 * @param minecraft minecraft location
 */
export async function installMinecraft(
  versionMeta: MinecraftVersionBaseInfo,
  minecraft: MinecraftLocation,
  options: JarOption = {},
): Promise<ResolvedVersion> {
  const folder = MinecraftFolder.from(minecraft)

  const version = await VersionJson.parse(folder, versionMeta.id).catch(async (e) => {
    if (options.diagnose) {
      throw e
    }
    if (
      !isBadVersionJsonError(e) &&
      !isCorruptedVersionJsonError(e) &&
      !isMissingVersionJsonError(e)
    ) {
      throw e
    }
    // Download json
    const jsonDestination = folder.getVersionJson(versionMeta.id)
    const jsonUrls = resolveDownloadUrls(versionMeta.url, versionMeta, options.json)
    await download({
      url: jsonUrls,
      destination: jsonDestination,
      ...getDownloadBaseOptions(options),
      tracker: onDownloadSingle(options.tracker, 'version.json', {
        id: versionMeta.id,
        url: versionMeta.url,
      }),
      signal: options.signal,
    })
    return VersionJson.parse(folder, versionMeta.id)
  })

  const side = options.side ?? 'client'
  await installMinecraftJar(version, options)

  if (side === 'server') {
    const jarPath = folder.getVersionJar(versionMeta.id, 'server')
    const server: Version = {
      id: versionMeta.id,
      type: 'release',
      time: version.time,
      releaseTime: version.releaseTime,
      jar: relative(folder.libraries, jarPath).replaceAll(sep, '/'),
      arguments: {
        game: [],
        jvm: [],
      },
      mainClass: '',
      minimumLauncherVersion: 13,
      libraries: [],
    }
    await writeFile(
      join(folder.getVersionRoot(versionMeta.id), 'server.json'),
      JSON.stringify(server, null, 2),
    )
  }
  return version
}
