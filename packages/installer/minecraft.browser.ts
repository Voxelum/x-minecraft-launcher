import { doFetch, FetchOptions } from './utils.browser'

export interface MinecraftVersionBaseInfo {
  /**
   * The version id, like 1.14.4
   */
  id: string
  /**
   * The version json download url
   */
  url: string
}

/**
 * The version metadata containing the version information, like download url
 */
export interface MinecraftVersion extends MinecraftVersionBaseInfo {
  /**
   * The version id, like 1.14.4
   */
  id: string
  type: string
  time: string
  releaseTime: string
  /**
   * The version json download url
   */
  url: string
}

/**
 * Minecraft version metadata list
 */
export interface MinecraftVersionList {
  latest: {
    /**
     * Snapshot version id of the Minecraft
     */
    snapshot: string
    /**
     * Release version id of the Minecraft, like 1.14.2
     */
    release: string
  }
  /**
   * All the vesrsion list
   */
  versions: MinecraftVersion[]
}

/**
 * Default minecraft version manifest url.
 */
export const DEFAULT_VERSION_MANIFEST_URL =
  'https://launchermeta.mojang.com/mc/game/version_manifest.json'

/**
 * Get and update the version list.
 * This try to send http GET request to offical Minecraft metadata endpoint by default.
 * You can swap the endpoint by passing url on `remote` in option.
 *
 * @returns The new list if there is
 */
export async function getVersionList(
  options: FetchOptions & {
    remote?: string
  } = {},
): Promise<MinecraftVersionList> {
  const response = await doFetch(options, options.remote ?? DEFAULT_VERSION_MANIFEST_URL)
  return (await response.json()) as any
}
