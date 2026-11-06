import { authenticate, handleAccountRoute } from './accounts.js'
import { handleMultiplayerRoute } from './multiplayer.js'
import { handleCurseforgeRoute } from './curseforge.js'

export { MultiplayerRoom } from './multiplayer.js'

// Minimal Vardrynn service. Accounts: accounts.js. Implements the status, release and database routes of VARDRYNN_SERVICE_API.md.
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

const encoder = new TextEncoder()
const hex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
const hmac = async (key, data) =>
  crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), encoder.encode(data))
const rfc3986 = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

// Presigned GET (AWS Signature V4, path style). The bucket needs credentials, the launcher has none.
export async function presign(env, url, expires, now = new Date()) {
  const region = env.S3_REGION || 'us-east-1'
  const stamp = now.toISOString().replace(/[-:]|\.\d{3}/g, '')
  const day = stamp.slice(0, 8)
  const scope = `${day}/${region}/s3/aws4_request`
  const query = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${env.S3_READ_ACCESS_KEY_ID}/${scope}`,
    'X-Amz-Date': stamp,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  }
  const canonicalQuery = Object.keys(query).sort().map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`).join('&')
  const path = url.pathname.split('/').map((segment) => rfc3986(decodeURIComponent(segment))).join('/')
  const canonical = ['GET', path, canonicalQuery, `host:${url.host}\n`, 'host', 'UNSIGNED-PAYLOAD'].join('\n')
  const toSign = ['AWS4-HMAC-SHA256', stamp, scope, hex(await crypto.subtle.digest('SHA-256', encoder.encode(canonical)))].join('\n')
  let key = encoder.encode(`AWS4${env.S3_READ_SECRET_ACCESS_KEY}`)
  for (const part of [day, region, 's3', 'aws4_request']) key = await hmac(key, part)
  return `${url.origin}${path}?${canonicalQuery}&X-Amz-Signature=${hex(await hmac(key, toSign))}`
}

const s3Configured = (env) =>
  Boolean(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_READ_ACCESS_KEY_ID && env.S3_READ_SECRET_ACCESS_KEY)

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
    const url = new URL(`${env.S3_BUCKET}/latest.json`, `${env.S3_ENDPOINT.replace(/\/?$/, '/')}`)
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
const DATABASE_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']

async function databaseAsset(request, env, name, asset) {
  if (!DATABASE_ASSETS[name]?.test(asset)) return json({ error: 'not_found' }, 404)
  if (!s3Configured(env)) return json({ error: 'database_unavailable' }, 503)
  try {
    const url = new URL(`${env.S3_BUCKET}/databases/${name}/${asset}`, `${env.S3_ENDPOINT.replace(/\/?$/, '/')}`)
    // The URL is signed for GET, so a HEAD request reads the headers and drops the body.
    const range = request.headers.get('range')
    const response = await fetch(await presign(env, url, 300), {
      redirect: 'manual',
      headers: range ? { range } : {},
    })
    if (response.status === 404) return json({ error: 'not_found' }, 404)
    if (!response.ok) {
      await response.body?.cancel()
      return json({ error: 'database_unavailable' }, 503)
    }
    const headers = new Headers({ 'cache-control': 'public, max-age=300' })
    for (const header of DATABASE_HEADERS) {
      const value = response.headers.get(header)
      if (value) headers.set(header, value)
    }
    if (request.method === 'HEAD') await response.body?.cancel()
    return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, headers })
  } catch {
    return json({ error: 'database_unavailable' }, 503)
  }
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
