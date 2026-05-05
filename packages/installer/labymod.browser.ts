import { doFetch, FetchOptions } from './utils.browser'

export interface LabyModManifest {
  labyModVersion: string
  commitReference: string
  sha1: string
  releaseTime: number
  size: number

  assets: {
    shader: string
    common: string
    fonts: string
    'vanilla-theme': string
    'fancy-theme': string
    i18n: string
  }

  minecraftVersions: MinecraftVersion[]
}

interface MinecraftVersion {
  tag: string
  version: string
  index: number
  type: string
  runtime: {
    name: string
    version: number
  }
  customManifestUrl: string
}

/**
 * Information about a LabyMod addon from the Flint store
 */
export interface LabyModAddon {
  id: number
  namespace: string
  name: string
  featured: boolean
  verified: boolean
  organization: number
  author: string
  downloads: number
  download_string: string
  short_description: string
  rating: {
    count: number
    rating: number
  }
  changelog: string
  required_labymod_build: number
  releases: number
  last_update: number
  licence: string
  version_string: string
  meta: string[]
  dependencies: Array<{
    namespace: string
    optional: boolean
  }>
  permissions: string[]
  file_hash: string
  source_url?: string
  brand_images: Array<{
    type: string
    hash: string
  }>
}

/**
 * Information about a LabyMod addon from the index
 */
export interface LabyModAddonIndex {
  name: string
  namespace: string
  short_description: string
  author: string
  organization_name: string
  ranking: number
  tags: number[]
  rating: {
    count: number
    rating: number
  }
  version_string: string
  meta: string[]
  dependencies: Array<{
    namespace: string
    optional: boolean
  }>
  required_labymod_build: number
  icon_hash: string
  thumbnail_hash: string
  file_hash: string
}

export async function getLabyModManifest(
  env = 'production',
  options?: FetchOptions,
): Promise<LabyModManifest> {
  const url = `https://laby-releases.s3.de.io.cloud.ovh.net/api/v1/manifest/${env}/latest.json`
  const res = await doFetch(options, url)
  return (await res.json()) as any
}

/**
 * Get the LabyMod addon index from Flint store
 * @param env The environment (production, beta, etc.)
 * @param options Request options
 * @returns List of all available addons
 */
export async function getLabyModAddonIndex(
  env = 'production',
  options?: FetchOptions,
): Promise<LabyModAddonIndex[]> {
  const url = `https://flintmc.net/api/client-store/get-index/${env}`
  const res = await doFetch(options, url)
  return (await res.json()) as any
}

/**
 * Get detailed information about a specific LabyMod addon
 * @param namespace The addon namespace (e.g., 'labyfabric', 'modcompat')
 * @param env The environment (production, beta, etc.)
 * @param options Request options
 * @returns Detailed addon information
 */
export async function getLabyModAddon(
  namespace: string,
  env = 'production',
  options?: FetchOptions,
): Promise<LabyModAddon> {
  const url = `https://flintmc.net/api/client-store/get-modification/${namespace}/${env}`
  const res = await doFetch(options, url)
  return (await res.json()) as any
}
