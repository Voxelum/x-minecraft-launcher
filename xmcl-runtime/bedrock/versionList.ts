import { BedrockVersion, BedrockVersionType } from '@xmcl/runtime-api'
import { request } from 'undici'

const MCAPPX_DEVELOPER_USER_AGENT = 'mcappx_developer'

interface VersionListEndpoint {
  url: string
  userAgent?: string
}

/**
 * Endpoints that serve the Minecraft Bedrock (UWP) version database. Each
 * returns either:
 * - a JSON array of `[versionName, updateIdentity, versionType]` tuples,
 *   where `versionType` is `0` (release), `1` (beta) or `2` (preview), as
 *   used by MCMrARM's `mc-w10-version-launcher`; or
 * - the mcappx.com Bedrock database object, whose `Variations[].MetaData`
 *   entries contain either direct package URLs or Windows Update identities.
 *
 * `mrarm.io` is the canonical global source. Inside the GFW it may be
 * unreachable, so the list is tried in order and the first reachable endpoint
 * wins. The MCAPPX source originates from mcappx.com and requires the
 * `mcappx_developer` User-Agent to bypass regional blocking for developer
 * access.
 */
const GLOBAL_ENDPOINTS: VersionListEndpoint[] = [
  { url: 'https://mrarm.io/r/w10-vdb' },
]

/**
 * GFW-friendly endpoints, tried first for users inside the GFW. Kept separate
 * so the ordering can be tuned without touching the global list.
 */
const GFW_ENDPOINTS: VersionListEndpoint[] = [
  // MCAPPX originates from mcappx.com and is guaranteed by its operator to
  // remain reachable inside the GFW for public launcher usage.
  { url: 'https://data.mcappx.com/v2/bedrock.json', userAgent: MCAPPX_DEVELOPER_USER_AGENT },
  { url: 'https://mrarm.io/r/w10-vdb' },
]

function toVersionType(raw: number): BedrockVersionType | undefined {
  switch (raw) {
    case 0: return 'release'
    case 1: return 'beta'
    case 2: return 'preview'
    default: return undefined
  }
}

function toVersionTypeFromString(raw: string): BedrockVersionType {
  switch (raw.toLowerCase()) {
    case 'beta': return 'beta'
    case 'preview': return 'preview'
    default: return 'release'
  }
}

function sortVersions(versions: BedrockVersion[]) {
  const typeWeight = (type: BedrockVersionType) => (type === 'release' ? 0 : type === 'beta' ? 1 : 2)
  versions.sort((a, b) => {
    const byVersion = b.version.localeCompare(a.version, undefined, { numeric: true })
    if (byVersion !== 0) return byVersion
    return typeWeight(a.type) - typeWeight(b.type)
  })
  return versions
}

function parseLegacyVersionDb(data: unknown): BedrockVersion[] {
  if (!Array.isArray(data)) {
    throw new Error('Unexpected Bedrock version database shape')
  }

  const result: BedrockVersion[] = []
  const seen = new Set<string>()
  // The database is ordered oldest-first; reverse so newest versions come first.
  for (const entry of [...data].reverse()) {
    if (!Array.isArray(entry) || entry.length < 3) continue
    const version = String(entry[0])
    const updateIdentity = String(entry[1])
    const type = toVersionType(Number(entry[2]))
    if (!type) continue
    const key = `${version}:${type}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ version, updateIdentity, type })
  }
  return result
}

function getMcAppxVersionsObject(data: Record<string, unknown>) {
  const fromMcAppx = data.From_mcappx_com ?? data['From_mcappx.com']
  if (fromMcAppx && typeof fromMcAppx === 'object' && !Array.isArray(fromMcAppx)) {
    return fromMcAppx as Record<string, unknown>
  }
  for (const [key, value] of Object.entries(data)) {
    if (key === 'CreationTime') continue
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return undefined
}

function pickMcAppxMetaData(build: Record<string, unknown>): string | undefined {
  const variations = Array.isArray(build.Variations) ? build.Variations : []
  const preferred = ['x64', 'neutral']
  const ordered = [
    ...preferred.flatMap((arch) => variations.filter((variation) => typeof variation === 'object' && variation !== null && String((variation as Record<string, unknown>).Arch ?? '').toLowerCase() === arch)),
    ...variations,
  ]

  for (const variation of ordered) {
    if (!variation || typeof variation !== 'object') continue
    const metadata = Array.isArray((variation as Record<string, unknown>).MetaData)
      ? ((variation as Record<string, unknown>).MetaData as unknown[])
      : []
    const last = [...metadata].reverse().find((value) => typeof value === 'string' && value.length > 0)
    if (typeof last === 'string') {
      return last
    }
  }

  return undefined
}

function parseMcAppxVersionDb(data: Record<string, unknown>): BedrockVersion[] {
  const versionsObject = getMcAppxVersionsObject(data)
  if (!versionsObject) {
    throw new Error('Unexpected MCAPPX Bedrock version database shape')
  }

  const result: BedrockVersion[] = []
  const seen = new Set<string>()
  for (const [versionKey, value] of Object.entries(versionsObject)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue
    const build = value as Record<string, unknown>
    const version = typeof build.ID === 'string' && build.ID.length > 0 ? build.ID : versionKey
    const updateIdentity = pickMcAppxMetaData(build)
    if (!updateIdentity) continue
    const type = toVersionTypeFromString(String(build.Type ?? 'release'))
    const key = `${version}:${type}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push({ version, updateIdentity, type })
  }

  return sortVersions(result)
}

function parseVersionDb(text: string): BedrockVersion[] {
  const data = JSON.parse(text)
  if (Array.isArray(data)) {
    return sortVersions(parseLegacyVersionDb(data))
  }
  if (data && typeof data === 'object') {
    return parseMcAppxVersionDb(data as Record<string, unknown>)
  }
  throw new Error('Unexpected Bedrock version database shape')
}

/**
 * Fetch the Bedrock version database, trying each candidate endpoint in order
 * until one succeeds.
 *
 * @param insideGFW Whether the user is likely inside the GFW; controls endpoint ordering.
 */
export async function fetchBedrockVersionList(insideGFW: boolean): Promise<BedrockVersion[]> {
  const endpoints = insideGFW
    ? [...GFW_ENDPOINTS, ...GLOBAL_ENDPOINTS]
    : [...GLOBAL_ENDPOINTS, ...GFW_ENDPOINTS]
  // De-duplicate while preserving order.
  const ordered = [...new Map(endpoints.map((endpoint) => [endpoint.url, endpoint])).values()]

  let lastError: unknown
  for (const endpoint of ordered) {
    try {
      const text = await fetchFollowingRedirects(endpoint)
      return parseVersionDb(text)
    } catch (e) {
      lastError = e
    }
  }
  throw lastError ?? new Error('Failed to fetch the Bedrock version list')
}

/**
 * GET a URL, manually following up to 5 redirects (the repo's undici typings do
 * not expose `maxRedirections`), and return the body text.
 */
async function fetchFollowingRedirects(endpoint: VersionListEndpoint, redirectsLeft = 5): Promise<string> {
  const headers = endpoint.userAgent ? { 'user-agent': endpoint.userAgent } : undefined
  const response = await request(endpoint.url, { method: 'GET', headers })
  const status = response.statusCode
  if (status >= 300 && status < 400 && redirectsLeft > 0) {
    const location = response.headers.location
    const next = Array.isArray(location) ? location[0] : location
    if (next) {
      // Drain the body before starting the next request.
      await response.body.dump().catch(() => undefined)
      return fetchFollowingRedirects({ ...endpoint, url: new URL(next, endpoint.url).toString() }, redirectsLeft - 1)
    }
  }
  const text = await response.body.text()
  if (status >= 400) {
    throw new Error(`Version list request to ${endpoint.url} failed with status ${status}`)
  }
  return text
}
