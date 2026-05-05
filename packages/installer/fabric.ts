import type { Version } from '@xmcl/core'
import { MinecraftFolder, MinecraftLocation } from '@xmcl/core'
import { writeFile } from 'fs/promises'
import { DEFAULT_META_URL_FABRIC, FabricLoaderArtifact } from './fabric.browser'
import { ensureFile, InstallOptions } from './utils'
import { doFetch, FetchOptions } from './utils.browser'

export interface FabricInstallOptions extends InstallOptions {
  side?: 'client' | 'server'
}

/**
 * Generate fabric version json from loader artifact.
 * @param loader The fabric loader artifact
 * @param side The side of the fabric
 * @param options
 * @returns The generated version json
 */
export function getVersionJsonFromLoaderArtifact(
  loader: FabricLoaderArtifact,
  side: 'client' | 'server',
  options: FabricInstallOptions = {},
) {
  const mcversion = loader.intermediary.version
  const id = options.versionId || `${mcversion}-fabric${loader.loader.version}`
  const libraries = [
    { name: loader.loader.maven, url: 'https://maven.fabricmc.net/' },
    { name: loader.intermediary.maven, url: 'https://maven.fabricmc.net/' },
    ...loader.launcherMeta.libraries.common,
    ...loader.launcherMeta.libraries[side],
  ]
  const mainClass = loader.launcherMeta.mainClass[side]
  const inheritsFrom = options.inheritsFrom || mcversion

  return {
    id,
    inheritsFrom,
    mainClass,
    libraries,
    arguments: {
      game: [],
      jvm: [],
    },
    releaseTime: new Date().toJSON(),
    time: new Date().toJSON(),
  }
}

/**
 * Install fabric version json.
 *
 * If side is `server`, it requires the Minecraft version json to be installed.
 *
 * @returns The installed version id
 */
export async function installFabricByLoaderArtifact(
  loader: FabricLoaderArtifact,
  minecraft: MinecraftLocation,
  options: FabricInstallOptions = {},
) {
  const folder = MinecraftFolder.from(minecraft)

  const side = options.side || 'client'
  const version = getVersionJsonFromLoaderArtifact(loader, side, options)

  const jsonFile =
    side === 'client' ? folder.getVersionJson(version.id) : folder.getVersionServerJson(version.id)
  await ensureFile(jsonFile)
  await writeFile(jsonFile, JSON.stringify(version, null, 4))

  return version.id
}

export interface InstallFabricVersionOptions extends FetchOptions, InstallOptions {
  minecraftVersion: string
  version: string
  minecraft: MinecraftLocation
  side?: 'client' | 'server'
}

export async function installFabric(options: InstallFabricVersionOptions) {
  const side = options.side ?? 'client'
  const url =
    side === 'client'
      ? `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/${options.minecraftVersion}/${options.version}/profile/json`
      : `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/${options.minecraftVersion}/${options.version}/server/json`
  const response = await doFetch(options, url)
  const content: Version = (await response.json()) as any

  const minecraft = MinecraftFolder.from(options.minecraft)
  if (options.inheritsFrom) {
    content.inheritsFrom = options.inheritsFrom
    content.id = options.versionId || `${options.inheritsFrom}-fabric${options.version}`
  } else {
    content.id = options.versionId || `${options.minecraftVersion}-fabric${options.version}`
  }

  const jsonPath =
    side === 'client'
      ? minecraft.getVersionJson(content.id)
      : minecraft.getVersionServerJson(content.id)

  await ensureFile(jsonPath)
  await writeFile(jsonPath, JSON.stringify(content))

  return content.id
}
