import { parse as parseForge } from '@xmcl/forge-site-parser'
import { doFetch, FetchOptions } from './utils.browser'

export interface ForgeVersionList {
  mcversion: string
  versions: ForgeVersion[]
}

/**
 * The forge version metadata to download a forge
 */
export interface ForgeVersion {
  /**
   * The installer info
   */
  installer: {
    md5: string
    sha1: string
    /**
     * The url path to concat with forge maven
     */
    path: string
  }
  universal: {
    md5: string
    sha1: string
    /**
     * The url path to concat with forge maven
     */
    path: string
  }
  /**
   * The minecraft version
   */
  mcversion: string
  /**
   * The forge version (without minecraft version)
   */
  version: string

  type: 'buggy' | 'recommended' | 'common' | 'latest'
}

export const DEFAULT_FORGE_MAVEN = 'http://files.minecraftforge.net/maven'

/**
 * Query the webpage content from files.minecraftforge.net.
 *
 * You can put the last query result to the fallback option. It will check if your old result is up-to-date.
 * It will request a new page only when the fallback option is outdated.
 *
 * @param option The option can control querying minecraft version, and page caching.
 */
export async function getForgeVersionList(
  options: FetchOptions & {
    /**
     * The minecraft version you are requesting
     */
    minecraft?: string
  } = {},
): Promise<ForgeVersionList> {
  const mcversion = options.minecraft || ''
  const url =
    mcversion === ''
      ? 'http://files.minecraftforge.net/maven/net/minecraftforge/forge/index.html'
      : `http://files.minecraftforge.net/maven/net/minecraftforge/forge/index_${mcversion}.html`
  const response = await doFetch(options, url)
  const body = parseForge(await response.text())
  return body as any
}
