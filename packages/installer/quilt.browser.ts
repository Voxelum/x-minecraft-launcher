import { FabricArtifactVersion, FabricLoaderArtifact } from './fabric.browser'
import { doFetch, FetchOptions } from './utils.browser'

export const DEFAULT_META_URL_QUILT = 'https://meta.quiltmc.org'

export interface GetQuiltOptions extends FetchOptions {
  minecraftVersion: string
}

export interface QuiltLoaderArtifact extends FabricLoaderArtifact {
  hashed: FabricLoaderArtifact['intermediary']
}

/**
 * Get supported quilt game versions
 */
export async function getQuiltGames(options?: FetchOptions): Promise<string[]> {
  const response = await doFetch(options, `${DEFAULT_META_URL_QUILT}/v3/game`)
  const body = (await response.json()) as Array<{ version: string }>
  return body.map((g) => g.version)
}

/**
 * Get quilt-loader artifact list
 */
export async function getQuiltLoaders(options?: FetchOptions): Promise<FabricArtifactVersion[]> {
  const response = await doFetch(options, `${DEFAULT_META_URL_QUILT}/v3/versions/loader`)
  const body = response.json()
  return body
}

/**
 * Get quilt loader versions list for a specific minecraft version
 */
export async function getQuiltLoaderVersionsByMinecraft(
  options: GetQuiltOptions,
): Promise<QuiltLoaderArtifact[]> {
  const response = await doFetch(
    options,
    `${DEFAULT_META_URL_QUILT}/v3/versions/loader/${options.minecraftVersion}`,
  )
  const content: QuiltLoaderArtifact[] = await response.json()
  return content
}
