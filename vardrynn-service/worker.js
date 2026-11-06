import { authenticate, handleAccountRoute } from './accounts.js'
import { handleMultiplayerRoute } from './multiplayer.js'
import { handleCurseforgeRoute } from './curseforge.js'
import { handlePackRoute } from './packs.js'
import { json, objectUrl, presign, s3Configured, streamObject } from './s3.js'

export { MultiplayerRoom } from './multiplayer.js'
export { presign }

// Minimal Vardrynn service. Accounts: accounts.js; packs: packs.js. Implements the status, release and database routes of VARDRYNN_SERVICE_API.md.

// Asset URLs are not covered by the release signature, so they can be swapped for short-lived
// presigned ones. Only URLs inside this bucket are touched.
async function presignAssets(env, release) {
  const endpoint = new URL(env.S3_ENDPOINT)
  const prefix = `/${env.S3_BUCKET}/`
  const ttl = Math.min(Math.max(Number(env.DOWNLOAD_URL_TTL_SECONDS) || 3600, 60), 86400)
  const assets = await Promise.all((release.assets ?? []).map(async (asset) => {
    try {
      const url = new URL(asset.url)
      if (url.origin !== endpoint.origin || !url.pathname.startsWith(prefix)) return asset
      return { ...asset, url: await presign(env, url, ttl) }
    } catch {
      return asset
    }
  }))
  return { ...release, assets }
}

async function readManifest(env) {
  if (s3Configured(env)) {
    const url = objectUrl(env, 'latest.json')
    // Workers reject redirect: 'error'. A redirect is not ok, so it fails below.
    const response = await fetch(await presign(env, url, 60), { redirect: 'manual' })
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`storage responded ${response.status}`)
    return presignAssets(env, await response.json())
  }
  if (!env.RELEASES) return undefined
  const object = await env.RELEASES.get('latest.json')
  return object ? object.json() : undefined
}

// The manifest is served as CI signed it. The launcher verifies it, so this only guards against
// a bad upload. It lives as `latest.json` in the S3 bucket (S3_* settings) or an R2 `RELEASES` binding.
async function latestRelease(env) {
  try {
    const release = await readManifest(env)
    if (!release) return json({ error: 'not_found' }, 404)
    if (release?.apiVersion !== 'v1') return json({ error: 'release_unavailable' }, 503)
    return json(release)
  } catch {
    return json({ error: 'release_unavailable' }, 503)
  }
}

// Mod metadata and project mapping databases, copied into the bucket's `databases/` prefix by the
// mirror-databases workflow. The launcher checks each file against the checksum file next to it.
const DATABASE_ASSETS = {
  'mod-metadata': /^db\.sqlite(\.sha1)?$/,
  'project-mapping': /^[a-z]{2,3}(-[a-z0-9]{2,8})?\.sqlite\.(gz|sha256)$/i,
}
function databaseAsset(request, env, name, asset) {
  if (!DATABASE_ASSETS[name]?.test(asset)) return json({ error: 'not_found' }, 404)
  return streamObject(request, env, `databases/${name}/${asset}`, 'public, max-age=300', 'database_unavailable')
}

export default {
  async fetch(request, env = {}) {
    const { pathname } = new URL(request.url)
    const account = await handleAccountRoute(request, env, pathname)
    if (account) return account
    const multiplayer = await handleMultiplayerRoute(request, env, pathname, authenticate)
    if (multiplayer) return multiplayer
    const curseforge = await handleCurseforgeRoute(request, env, pathname)
    if (curseforge) return curseforge
    const pack = await handlePackRoute(request, env, pathname)
    if (pack) return pack
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return json({ error: 'method_not_allowed' }, 405)
    }
    if (pathname === '/v1/status') return json({ apiVersion: 'v1', state: 'ok' })
    if (pathname === '/v1/releases/latest') return latestRelease(env)
    const database = /^\/v1\/databases\/([^/]+)\/([^/]+)$/.exec(pathname)
    if (database) return databaseAsset(request, env, database[1], database[2])
    return json({ error: 'not_found' }, 404)
  },
}
