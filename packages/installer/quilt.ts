import { MinecraftFolder, MinecraftLocation, Version } from '@xmcl/core'
import { writeFile } from 'fs/promises'
import { InstallOptions } from './utils'
import { DEFAULT_META_URL_QUILT } from './quilt.browser'
import { ensureFile } from './utils'
import { doFetch, FetchOptions } from './utils.browser'

export {
  DEFAULT_META_URL_QUILT,
  getQuiltGames,
  getQuiltLoaders,
  getQuiltLoaderVersionsByMinecraft,
} from './quilt.browser'
export type { GetQuiltOptions, QuiltLoaderArtifact } from './quilt.browser'

export interface InstallQuiltVersionOptions extends FetchOptions, InstallOptions {
  minecraftVersion: string
  version: string
  minecraft: MinecraftLocation
  side?: 'client' | 'server'
}

/**
 * Install quilt version via profile API
 */
export async function installQuiltVersion(options: InstallQuiltVersionOptions) {
  const side = options.side ?? 'client'
  const url =
    side === 'client'
      ? `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}/${options.version}/profile/json`
      : `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}/${options.version}/server/json`
  const response = await doFetch(options, url)
  const content: Version = (await response.json()) as any

  const minecraft = MinecraftFolder.from(options.minecraft)
  if (options.inheritsFrom) {
    content.inheritsFrom = options.inheritsFrom
    content.id = options.versionId || `${options.inheritsFrom}-quilt${options.version}`
  } else {
    content.id = options.versionId || `${options.minecraftVersion}-quilt${options.version}`
  }

  const jsonPath =
    side === 'client'
      ? minecraft.getVersionJson(content.id)
      : minecraft.getVersionServerJson(content.id)

  await ensureFile(jsonPath)
  await writeFile(jsonPath, JSON.stringify(content))

  return content.id
}
