import { FetchOptions, doFetch } from './utils.browser'

export const DEFAULT_META_URL_FABRIC = 'https://meta.fabricmc.net'

export interface FabricArtifactVersion {
  gameVersion?: string // "20w10a",
  separator?: string
  build?: number
  maven: string // "net.fabricmc:yarn:20w10a+build.7",
  version: string // "20w10a+build.7",
  stable: boolean
}

export interface FabricArtifacts {
  mappings: FabricArtifactVersion[]
  loader: FabricArtifactVersion[]
}

export interface FabricLoaderArtifact {
  loader: FabricArtifactVersion
  intermediary: FabricArtifactVersion
  launcherMeta: {
    version: number
    libraries: {
      client: { name: string; url: string }[]
      common: { name: string; url: string }[]
      server: { name: string; url: string }[]
    }
    mainClass: {
      client: string
      server: string
    }
  }
}

/**
 * Get supported fabric game versions
 */
export async function getFabricGames(options?: FetchOptions): Promise<string[]> {
  const response = await doFetch(options, `${DEFAULT_META_URL_FABRIC}/v2/game`)
  const body = (await response.json()) as Array<{ version: string }>
  return body.map((g) => g.version)
}

/**
 * Get fabric-loader artifact list
 */
export async function getFabricLoaders(options?: FetchOptions): Promise<FabricArtifactVersion[]> {
  const response = await doFetch(options, `${DEFAULT_META_URL_FABRIC}/v2/versions/loader`)
  const body = response.json()
  return body
}

/**
 * Get fabric-loader artifact list by Minecraft version
 * @param minecraft The minecraft version
 */
export async function getLoaderArtifactListFor(
  minecraft: string,
  options?: FetchOptions,
): Promise<FabricLoaderArtifact[]> {
  const response = await doFetch(
    options,
    `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/` + minecraft,
  )
  const body = response.json()
  return body
}
/**
 * Get fabric-loader artifact list by Minecraft version
 * @param minecraft The minecraft version
 * @param loader The yarn-loader version
 */
export async function getFabricLoaderArtifact(
  minecraft: string,
  loader: string,
  options?: FetchOptions,
): Promise<FabricLoaderArtifact> {
  const response = await doFetch(
    options,
    `${DEFAULT_META_URL_FABRIC}/v2/versions/loader/` + minecraft + '/' + loader,
  )
  const body = response.json()
  return body
}
