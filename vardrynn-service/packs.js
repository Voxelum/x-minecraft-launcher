// Vardrynn packs: modpacks whose files can come from Modrinth, CurseForge or this service.
// A version's manifest is the launcher's instance manifest (packages/instance/files.ts).
// Anyone can read packs. Only accounts listed in PACK_PUBLISHER_ACCOUNT_IDS can publish.
import { authenticate } from './accounts.js'
import { hex, json, objectUrl, presign, s3Configured, streamObject } from './s3.js'

// `files` would collide with the file route.
const SLUG = /^(?!files$)[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const VERSION = /^[A-Za-z0-9][A-Za-z0-9.+_-]{0,63}$/
const SHA1 = /^[0-9a-f]{40}$/
const MAX_FILE_BYTES = 50 * 1024 * 1024
const MAX_JSON_BYTES = 1024 * 1024
const MAX_MANIFEST_FILES = 5000
const MAX_LISTED_PACKS = 100
const LOADERS = ['forge', 'neoForged', 'fabricLoader', 'quiltLoader']
// Files the launcher manages itself; a pack must not overwrite them.
const RESERVED_ROOTS = /^(\.install.*|instance\.json|instance-lock\.json(\.tmp)?|unresolved-files\.json)$/i
const IMMUTABLE = 'public, max-age=31536000, immutable'

const fail = (status, error, detail) => Object.assign(new Error(error), { status, code: error, detail })
const nowIso = (now) => new Date(now).toISOString()
const fileKey = (sha1) => `packs/files/${sha1}`
const fileUrl = (origin, sha1) => `${origin}/v1/packs/files/${sha1}`

async function readJson(request) {
  if (Number(request.headers.get('content-length')) > MAX_JSON_BYTES) throw fail(413, 'payload_too_large')
  const bytes = await request.arrayBuffer()
  if (bytes.byteLength > MAX_JSON_BYTES) throw fail(413, 'payload_too_large')
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw fail(400, 'invalid_request')
  }
}

function text(value, field, max, min = 0) {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) throw fail(400, 'invalid_request', field)
  return value.trim()
}

async function publisher(request, env, now) {
  const auth = await authenticate(request, env, now)
  const allowed = String(env.PACK_PUBLISHER_ACCOUNT_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  if (!allowed.includes(auth.accountId)) throw fail(403, 'forbidden')
  return auth
}

async function ownedPack(env, slug, accountId) {
  const pack = await env.DB.prepare('SELECT owner_account_id FROM packs WHERE slug = ?').bind(slug).first()
  if (!pack) throw fail(404, 'not_found')
  if (pack.owner_account_id !== accountId) throw fail(403, 'forbidden')
}

// Relative, no `.` or `..` segments, no drive letters or backslashes, and not a launcher file.
function safePath(path) {
  if (typeof path !== 'string' || !path || path.length > 512 || /[\\:]/.test(path) || path.includes('\u0000') || path.startsWith('/')) return false
  const segments = path.split('/')
  return segments.every((s) => s && s !== '.' && s !== '..') && !RESERVED_ROOTS.test(segments[0])
}

function validSource(file) {
  const cf = file.curseforge
  const mr = file.modrinth
  if (cf !== undefined && !(Number.isInteger(cf?.projectId) && Number.isInteger(cf?.fileId))) return false
  if (mr !== undefined && !(typeof mr?.projectId === 'string' && mr.projectId && typeof mr?.versionId === 'string' && mr.versionId)) return false
  if (file.downloads !== undefined) {
    if (!Array.isArray(file.downloads)) return false
    for (const url of file.downloads) {
      try {
        if (new URL(url).protocol !== 'https:') return false
      } catch {
        return false
      }
    }
  }
  return Boolean(cf || mr || file.downloads?.length)
}

/** Returns the Minecraft version and loader names; throws `invalid_manifest` naming the first problem. */
export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw fail(400, 'invalid_manifest', 'manifest')
  const runtime = manifest.runtime
  if (!runtime || typeof runtime.minecraft !== 'string' || !runtime.minecraft) throw fail(400, 'invalid_manifest', 'runtime.minecraft')
  if (!Array.isArray(manifest.files) || manifest.files.length > MAX_MANIFEST_FILES) throw fail(400, 'invalid_manifest', 'files')
  const paths = new Set()
  for (const file of manifest.files) {
    const path = file?.path
    if (!safePath(path)) throw fail(400, 'invalid_manifest', `files: unsafe path ${JSON.stringify(path)}`)
    if (paths.has(path.toLowerCase())) throw fail(400, 'invalid_manifest', `files: duplicate path ${path}`)
    paths.add(path.toLowerCase())
    if (!SHA1.test(file.hashes?.sha1 ?? '')) throw fail(400, 'invalid_manifest', `files: ${path} needs a sha1`)
    if (!validSource(file)) throw fail(400, 'invalid_manifest', `files: ${path} has no valid source`)
  }
  return { minecraft: runtime.minecraft, loaders: LOADERS.filter((k) => typeof runtime[k] === 'string' && runtime[k]) }
}

const packBody = (row, origin) => ({
  slug: row.slug,
  title: row.title,
  summary: row.summary,
  iconUrl: row.icon_sha1 ? fileUrl(origin, row.icon_sha1) : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

const versionBody = (row) => ({
  id: row.id,
  version: row.version,
  changelog: row.changelog,
  minecraft: row.minecraft,
  loaders: JSON.parse(row.loaders),
  publishedAt: row.published_at,
})

// Lists packs with at least one version, newest version first.
async function listPacks(env, origin, query) {
  const like = query ? `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null
  const { results } = await env.DB.prepare(
    `SELECT p.*, v.id AS v_id, v.version AS v_version, v.changelog AS v_changelog, v.minecraft AS v_minecraft,
       v.loaders AS v_loaders, v.published_at AS v_published_at
     FROM packs p JOIN pack_versions v ON v.id = (
       SELECT id FROM pack_versions WHERE pack_slug = p.slug ORDER BY published_at DESC, rowid DESC LIMIT 1)
     WHERE ?1 IS NULL OR p.title LIKE ?1 ESCAPE '\\'
     ORDER BY v.published_at DESC LIMIT ${MAX_LISTED_PACKS}`,
  ).bind(like).all()
  return {
    apiVersion: 'v1',
    packs: results.map((row) => ({
      ...packBody(row, origin),
      latestVersion: versionBody({
        id: row.v_id, version: row.v_version, changelog: row.v_changelog, minecraft: row.v_minecraft,
        loaders: row.v_loaders, published_at: row.v_published_at,
      }),
    })),
  }
}

async function getPack(env, slug, origin, includeEmpty = false) {
  const pack = await env.DB.prepare('SELECT * FROM packs WHERE slug = ?').bind(slug).first()
  if (!pack) throw fail(404, 'not_found')
  const { results } = await env.DB.prepare(
    'SELECT id, version, changelog, minecraft, loaders, published_at FROM pack_versions WHERE pack_slug = ? ORDER BY published_at DESC, rowid DESC',
  ).bind(slug).all()
  // A pack becomes public with its first version.
  if (!results.length && !includeEmpty) throw fail(404, 'not_found')
  return { apiVersion: 'v1', pack: { ...packBody(pack, origin), description: pack.description, versions: results.map(versionBody) } }
}

async function putPack(request, env, slug, origin, now) {
  const auth = await publisher(request, env, now)
  const body = await readJson(request)
  const title = text(body?.title, 'title', 100, 1)
  const summary = text(body.summary ?? '', 'summary', 300)
  const description = text(body.description ?? '', 'description', 20000)
  const iconSha1 = body.iconSha1 ?? null
  if (iconSha1 !== null && !SHA1.test(iconSha1)) throw fail(400, 'invalid_request', 'iconSha1')
  const existing = await env.DB.prepare('SELECT owner_account_id FROM packs WHERE slug = ?').bind(slug).first()
  if (existing && existing.owner_account_id !== auth.accountId) throw fail(403, 'forbidden')
  if (existing) {
    await env.DB.prepare('UPDATE packs SET title = ?, summary = ?, description = ?, icon_sha1 = ?, updated_at = ? WHERE slug = ?')
      .bind(title, summary, description, iconSha1, nowIso(now), slug).run()
  } else {
    await env.DB.prepare(
      'INSERT INTO packs (slug, owner_account_id, title, summary, description, icon_sha1, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(slug, auth.accountId, title, summary, description, iconSha1, nowIso(now), nowIso(now)).run()
  }
  return json(await getPack(env, slug, origin, true), existing ? 200 : 201)
}

async function publishVersion(request, env, slug, now) {
  const auth = await publisher(request, env, now)
  await ownedPack(env, slug, auth.accountId)
  const body = await readJson(request)
  if (typeof body?.version !== 'string' || !VERSION.test(body.version)) throw fail(400, 'invalid_request', 'version')
  const changelog = text(body.changelog ?? '', 'changelog', 20000)
  const { minecraft, loaders } = validateManifest(body.manifest)
  const taken = await env.DB.prepare('SELECT 1 FROM pack_versions WHERE pack_slug = ? AND version = ?').bind(slug, body.version).first()
  if (taken) throw fail(409, 'version_exists')
  const row = {
    id: crypto.randomUUID(), version: body.version, changelog, minecraft,
    loaders: JSON.stringify(loaders), published_at: nowIso(now),
  }
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO pack_versions (id, pack_slug, version, changelog, minecraft, loaders, manifest, published_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).bind(row.id, slug, row.version, changelog, minecraft, row.loaders, JSON.stringify(body.manifest), row.published_at),
    env.DB.prepare('UPDATE packs SET updated_at = ? WHERE slug = ?').bind(row.published_at, slug),
  ])
  return json({ apiVersion: 'v1', version: { ...versionBody(row), manifest: body.manifest } }, 201)
}

async function getVersion(env, slug, id) {
  const row = await env.DB.prepare('SELECT * FROM pack_versions WHERE id = ? AND pack_slug = ?').bind(id, slug).first()
  if (!row) throw fail(404, 'not_found')
  return json({ apiVersion: 'v1', version: { ...versionBody(row), manifest: JSON.parse(row.manifest) } })
}

async function deleteVersion(request, env, slug, id, now) {
  const auth = await publisher(request, env, now)
  await ownedPack(env, slug, auth.accountId)
  const { meta } = await env.DB.prepare('DELETE FROM pack_versions WHERE id = ? AND pack_slug = ?').bind(id, slug).run()
  if (!meta.changes) throw fail(404, 'not_found')
  return new Response(null, { status: 204 })
}

// Files are stored by sha1, so an upload is checked against its name and never changes afterwards.
async function uploadFile(request, env, sha1, origin, now) {
  if (!env.DB) throw fail(503, 'packs_unconfigured')
  await publisher(request, env, now)
  if (!s3Configured(env) || !env.S3_PACKS_ACCESS_KEY_ID || !env.S3_PACKS_SECRET_ACCESS_KEY) throw fail(503, 'pack_storage_unavailable')
  if (Number(request.headers.get('content-length')) > MAX_FILE_BYTES) throw fail(413, 'payload_too_large')
  const body = await request.arrayBuffer()
  if (body.byteLength > MAX_FILE_BYTES) throw fail(413, 'payload_too_large')
  if (hex(await crypto.subtle.digest('SHA-1', body)) !== sha1) throw fail(400, 'hash_mismatch')
  const target = await presign(env, objectUrl(env, fileKey(sha1)), 300, new Date(now), {
    method: 'PUT', accessKeyId: env.S3_PACKS_ACCESS_KEY_ID, secretAccessKey: env.S3_PACKS_SECRET_ACCESS_KEY,
  })
  const response = await fetch(target, { method: 'PUT', body, redirect: 'manual' })
  await response.body?.cancel()
  if (!response.ok) throw fail(503, 'pack_storage_unavailable')
  return json({ apiVersion: 'v1', sha1, size: body.byteLength, url: fileUrl(origin, sha1) }, 201)
}

async function route(request, env, pathname, now) {
  const method = request.method
  const url = new URL(request.url)
  const origin = env.PUBLIC_ORIGIN || url.origin
  let m
  if ((m = /^\/v1\/packs\/files\/([^/]+)$/.exec(pathname))) {
    if (!SHA1.test(m[1])) throw fail(404, 'not_found')
    if (method === 'GET' || method === 'HEAD') return streamObject(request, env, fileKey(m[1]), IMMUTABLE, 'pack_storage_unavailable')
    if (method === 'PUT') return uploadFile(request, env, m[1], origin, now)
    throw fail(405, 'method_not_allowed')
  }
  if (!env.DB) throw fail(503, 'packs_unconfigured')
  if (pathname === '/v1/packs') {
    if (method === 'GET') return json(await listPacks(env, origin, url.searchParams.get('q')?.trim() || null))
    throw fail(405, 'method_not_allowed')
  }
  if ((m = /^\/v1\/packs\/([^/]+)$/.exec(pathname)) && SLUG.test(m[1])) {
    if (method === 'GET') return json(await getPack(env, m[1], origin))
    if (method === 'PUT') return putPack(request, env, m[1], origin, now)
    throw fail(405, 'method_not_allowed')
  }
  if ((m = /^\/v1\/packs\/([^/]+)\/versions$/.exec(pathname)) && SLUG.test(m[1])) {
    if (method === 'POST') return publishVersion(request, env, m[1], now)
    throw fail(405, 'method_not_allowed')
  }
  if ((m = /^\/v1\/packs\/([^/]+)\/versions\/([^/]+)$/.exec(pathname)) && SLUG.test(m[1])) {
    if (method === 'GET') return getVersion(env, m[1], m[2])
    if (method === 'DELETE') return deleteVersion(request, env, m[1], m[2], now)
    throw fail(405, 'method_not_allowed')
  }
  throw fail(404, 'not_found')
}

/** Returns a Response for pack routes, or undefined when the path is not one. */
export async function handlePackRoute(request, env, pathname, now = Date.now()) {
  if (!/^\/v1\/packs(\/|$)/.test(pathname)) return undefined
  const requestId = crypto.randomUUID()
  try {
    return await route(request, env, pathname, now)
  } catch (e) {
    if (e?.status) return json({ error: e.code, ...(e.detail ? { detail: e.detail } : {}), requestId }, e.status)
    return json({ error: 'internal_error', requestId }, 500)
  }
}
