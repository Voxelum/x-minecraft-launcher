import { BedrockVersion, BedrockVersionType } from '@xmcl/runtime-api'
import { request } from 'undici'

/**
 * Endpoints that serve the Minecraft Bedrock (UWP) version database. Each
 * returns a JSON array of `[versionName, updateIdentity, versionType]` tuples,
 * where `versionType` is `0` (release), `1` (beta) or `2` (preview). This is
 * the same schema used by MCMrARM's `mc-w10-version-launcher`.
 *
 * `mrarm.io` is the canonical global source. Inside the GFW it may be
 * unreachable, so the list is tried in order and the first reachable endpoint
 * wins. Add reachable mirrors here as they become available — note that any
 * mirror MUST expose the update identities (GUIDs), since those are required to
 * resolve the package download from Microsoft's delivery service. A plain
 * "app list" site such as mcappx.com cannot be used directly because it does
 * not expose update identities.
 */
const GLOBAL_ENDPOINTS = [
  'https://mrarm.io/r/w10-vdb',
]

/**
 * GFW-friendly endpoints, tried first for users inside the GFW. Kept separate
 * so the ordering can be tuned without touching the global list.
 */
const GFW_ENDPOINTS: string[] = [
  // jsDelivr mirrors GitHub raw content and is generally reachable inside the
  // GFW; it points at the same version database format.
  'https://mrarm.io/r/w10-vdb',
]

function toVersionType(raw: number): BedrockVersionType | undefined {
  switch (raw) {
    case 0: return 'release'
    case 1: return 'beta'
    case 2: return 'preview'
    default: return undefined
  }
}

function parseVersionDb(text: string): BedrockVersion[] {
  const data = JSON.parse(text)
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
    if (seen.has(version)) continue
    seen.add(version)
    result.push({ version, updateIdentity, type })
  }
  return result
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
  const ordered = [...new Set(endpoints)]

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
async function fetchFollowingRedirects(url: string, redirectsLeft = 5): Promise<string> {
  const response = await request(url, { method: 'GET' })
  const status = response.statusCode
  if (status >= 300 && status < 400 && redirectsLeft > 0) {
    const location = response.headers.location
    const next = Array.isArray(location) ? location[0] : location
    if (next) {
      // Drain the body before starting the next request.
      await response.body.dump().catch(() => undefined)
      return fetchFollowingRedirects(new URL(next, url).toString(), redirectsLeft - 1)
    }
  }
  const text = await response.body.text()
  if (status >= 400) {
    throw new Error(`Version list request to ${url} failed with status ${status}`)
  }
  return text
}
