interface Env {
  SUPABASE_URL: string
  SUPABASE_SECRET_KEY: string
  SUPABASE_STORAGE_PUBLIC_URL?: string
  CORS_ORIGIN?: string
}

interface AccountRow {
  id: string
  username: string
  normalized_username: string
  offline_uuid: string
  password_hash: string
  skin_url: string | null
  cape_url: string | null
  skin_model: 'steve' | 'slim'
  created_at: string
  updated_at: string
}

interface SessionRow {
  id: string
  account_id: string
  token_hash: string
  expires_at: string
}

// Cloudflare Workers Web Crypto limits PBKDF2 to 100,000 iterations.
const PBKDF2_ITERATIONS = 100_000
// Hosted offline sessions last one year and are extended whenever the
// launcher validates the account through GET /v1/accounts/me.
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,16}$/

class SupabaseError extends Error {
  constructor(readonly status: number) {
    super(`Supabase request failed: ${status}`)
  }
}

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function response(body: unknown, status = 200, env?: Env, request?: Request) {
  const headers = new Headers(jsonHeaders)
  const origin = request?.headers.get('Origin')
  const allowedOrigin = env?.CORS_ORIGIN === '*' ? '*' : env?.CORS_ORIGIN || origin || ''
  if (allowedOrigin) {
    headers.set('access-control-allow-origin', allowedOrigin)
    headers.set('access-control-allow-headers', 'authorization, content-type')
    headers.set('access-control-allow-methods', 'GET, POST, PUT, OPTIONS')
    headers.set('vary', 'Origin')
  }
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers })
}

function error(message: string, status: number, env: Env, request: Request) {
  return response({ error: message }, status, env, request)
}

function normalizeUsername(username: unknown) {
  if (typeof username !== 'string') return undefined
  const value = username.trim()
  return USERNAME_PATTERN.test(value) ? value : undefined
}

function normalizeUuid(uuid: unknown) {
  if (typeof uuid !== 'string') return undefined
  const value = uuid.trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value) ? value : undefined
}

function normalizeMinecraftUuid(uuid: unknown) {
  if (typeof uuid !== 'string') return undefined
  const value = uuid.trim()
  const dashed = value.length === 32
    ? `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`
    : value
  return normalizeUuid(dashed)
}

function md5(value: string) {
  const input = new TextEncoder().encode(value)
  const length = (((input.length + 8) >>> 6) + 1) * 16
  const words = new Uint32Array(length)
  for (let i = 0; i < input.length; i++) words[i >>> 2] |= input[i] << ((i & 3) * 8)
  words[input.length >>> 2] |= 0x80 << ((input.length & 3) * 8)
  words[length - 2] = input.length * 8
  let a = 0x67452301
  let b = 0xefcdab89
  let c = 0x98badcfe
  let d = 0x10325476
  const shifts = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]
  const rotate = (x: number, n: number) => (x << n) | (x >>> (32 - n))
  for (let offset = 0; offset < length; offset += 16) {
    let aa = a; let bb = b; let cc = c; let dd = d
    for (let i = 0; i < 64; i++) {
      let f: number; let g: number
      if (i < 16) { f = (bb & cc) | (~bb & dd); g = i }
      else if (i < 32) { f = (dd & bb) | (~dd & cc); g = (5 * i + 1) % 16 }
      else if (i < 48) { f = bb ^ cc ^ dd; g = (3 * i + 5) % 16 }
      else { f = cc ^ (bb | ~dd); g = (7 * i) % 16 }
      const k = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000)
      const s = shifts[(i % 4) + (i < 16 ? 0 : i < 32 ? 4 : i < 48 ? 8 : 12)]
      const next = (aa + f + k + words[offset + g]) | 0
      aa = dd; dd = cc; cc = bb; bb = (bb + rotate(next, s)) | 0
    }
    a = (a + aa) | 0; b = (b + bb) | 0; c = (c + cc) | 0; d = (d + dd) | 0
  }
  const bytes = new Uint8Array(16)
  const values = [a, b, c, d]
  for (let i = 0; i < values.length; i++) {
    for (let j = 0; j < 4; j++) bytes[i * 4 + j] = (values[i] >>> (j * 8)) & 0xff
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x30
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5')
}

function toBase64Url(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let value = ''
  for (const byte of view) value += String.fromCharCode(byte)
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

function fromBase64Url(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

async function hashPassword(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256)
  return toBase64Url(bits)
}

async function createPasswordHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await hashPassword(password, salt)
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${toBase64Url(salt)}$${hash}`
}

async function verifyPassword(password: string, encoded: string) {
  const [algorithm, iterationsText, saltText, expected] = encoded.split('$')
  const iterations = Number(iterationsText)
  if (algorithm !== 'pbkdf2_sha256' || iterations !== PBKDF2_ITERATIONS || !saltText || !expected) return false
  const actual = await hashPassword(password, fromBase64Url(saltText))
  if (actual.length !== expected.length) return false
  let mismatch = 0
  for (let i = 0; i < actual.length; i++) mismatch |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
  return mismatch === 0
}

async function sha256(value: string) {
  return toBase64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
}

function supabaseUrl(env: Env, path: string) {
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`
}

function storageUrl(env: Env, path: string) {
  return `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/${path}`
}

async function supabase<T>(env: Env, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('apikey', env.SUPABASE_SECRET_KEY)
  headers.set('authorization', `Bearer ${env.SUPABASE_SECRET_KEY}`)
  headers.set('content-type', 'application/json')
  const result = await fetch(supabaseUrl(env, path), { ...init, headers })
  console.log(`[offline-auth] Supabase ${init.method || 'GET'} ${path.split('?')[0]} -> ${result.status}`)
  if (!result.ok) throw new SupabaseError(result.status)
  if (result.status === 204) return undefined as T
  const body = await result.text()
  return body ? JSON.parse(body) as T : undefined as T
}

async function uploadSkin(env: Env, account: AccountRow, image: ArrayBuffer, kind: 'skins' | 'capes' = 'skins') {
  const objectPath = kind === 'capes' ? `skins/capes/${account.id}.png` : `skins/${account.id}.png`
  const result = await fetch(storageUrl(env, `object/${objectPath}`), {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      'content-type': 'image/png',
      'x-upsert': 'true',
    },
    body: image,
  })
  console.log(`[offline-auth] Supabase Storage ${kind.slice(0, -1)} upload -> ${result.status}`)
  if (!result.ok) throw new Error(`${kind.slice(0, -1)} upload failed: ${result.status}`)
  const publicBase = env.SUPABASE_STORAGE_PUBLIC_URL?.replace(/\/$/, '') || `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public`
  // Keep the object path stable, but version the URL so Minecraft does not
  // reuse a cached texture after the account changes its skin.
  return `${publicBase}/${objectPath}?v=${Date.now()}`
}

function isMinecraftSkin(image: Uint8Array) {
  // Only canonical modern atlases are published. Legacy atlases are converted
  // by the launcher before upload, so Minecraft never receives ambiguous UVs.
  if (image.length < 24 || image[0] !== 0x89 || image[1] !== 0x50 || image[2] !== 0x4e || image[3] !== 0x47 || image[12] !== 0x49 || image[13] !== 0x48 || image[14] !== 0x44 || image[15] !== 0x52) return false
  const width = image[16] * 0x1000000 + image[17] * 0x10000 + image[18] * 0x100 + image[19]
  const height = image[20] * 0x1000000 + image[21] * 0x10000 + image[22] * 0x100 + image[23]
  return width === 64 && height === 64
}

function isMinecraftCape(image: Uint8Array) {
  if (image.length < 24 || image[0] !== 0x89 || image[1] !== 0x50 || image[2] !== 0x4e || image[3] !== 0x47 || image[12] !== 0x49 || image[13] !== 0x48 || image[14] !== 0x44 || image[15] !== 0x52) return false
  const width = image[16] * 0x1000000 + image[17] * 0x10000 + image[18] * 0x100 + image[19]
  const height = image[20] * 0x1000000 + image[21] * 0x10000 + image[22] * 0x100 + image[23]
  return width === 64 && height === 32
}

function accountView(account: AccountRow) {
  return {
    id: account.id,
    username: account.username,
    offlineUuid: account.offline_uuid,
    skinUrl: account.skin_url,
    capeUrl: account.cape_url,
    skinModel: account.skin_model,
  }
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function yggdrasilProfile(account: AccountRow, profileId = account.offline_uuid) {
  return {
    id: profileId.replaceAll('-', ''),
    name: account.username,
    properties: [
      { name: 'uploadableTextures', value: 'skin,cape' },
      ...(account.skin_url || account.cape_url ? [{
        name: 'textures',
        value: encodeBase64(JSON.stringify({
          timestamp: Date.now(),
          profileId: profileId.replaceAll('-', ''),
          profileName: account.username,
          textures: {
            ...(account.skin_url ? { SKIN: { url: account.skin_url, metadata: { model: account.skin_model } } } : {}),
            ...(account.cape_url ? { CAPE: { url: account.cape_url } } : {}),
          },
        })),
      }] : []),
    ],
  }
}

async function findAccountByUuid(env: Env, uuid: string) {
  const offlineUuid = normalizeMinecraftUuid(uuid)
  if (!offlineUuid) return undefined
  const accounts = await supabase<AccountRow[]>(env, `offline_accounts?offline_uuid=eq.${encodeURIComponent(offlineUuid)}&select=*`)
  if (accounts[0]) return { account: accounts[0], profileId: accounts[0].offline_uuid }
  const allAccounts = await supabase<AccountRow[]>(env, 'offline_accounts?select=*')
  const crackedAccount = allAccounts.find((account) => md5(`OfflinePlayer:${account.username}`) === offlineUuid)
  return crackedAccount ? { account: crackedAccount, profileId: offlineUuid } : undefined
}

async function findAccountByUsername(env: Env, username: string) {
  const normalized = normalizeUsername(username)
  if (!normalized) return undefined
  const accounts = await supabase<AccountRow[]>(env, `offline_accounts?normalized_username=eq.${encodeURIComponent(normalized.toLowerCase())}&select=*`)
  return accounts[0]
}

function yggdrasilPath(pathname: string) {
  if (pathname === '/yggdrasil') return '/'
  if (pathname.startsWith('/yggdrasil/')) return pathname.substring('/yggdrasil'.length)
  return pathname
}

function yggdrasilMetadata(env: Env) {
  const storageBase = env.SUPABASE_STORAGE_PUBLIC_URL || `${env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public`
  const skinDomain = new URL(storageBase).hostname
  return {
    meta: {
      implementationName: 'xmcl-offline-auth',
      implementationVersion: '0.0.1',
      serverName: 'XMCL Offline Auth',
    },
    skinDomains: [skinDomain],
  }
}

async function getSessionForRequest(request: Request, env: Env) {
  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return undefined
  const tokenHash = await sha256(authorization.substring('Bearer '.length))
  const sessions = await supabase<SessionRow[]>(env, `offline_sessions?token_hash=eq.${encodeURIComponent(tokenHash)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`)
  return sessions[0]
}

async function getAccountForSession(request: Request, env: Env) {
  const session = await getSessionForRequest(request, env)
  if (!session) return undefined
  const accounts = await supabase<AccountRow[]>(env, `offline_accounts?id=eq.${encodeURIComponent(session.account_id)}&select=*`)
  return accounts[0]
}

async function refreshSession(request: Request, env: Env) {
  const session = await getSessionForRequest(request, env)
  if (!session) return undefined
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString()
  await supabase(env, `offline_sessions?token_hash=eq.${encodeURIComponent(session.token_hash)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ expires_at: expiresAt }),
  })
  const accounts = await supabase<AccountRow[]>(env, `offline_accounts?id=eq.${encodeURIComponent(session.account_id)}&select=*`)
  return accounts[0] ? { account: accounts[0], expiresAt } : undefined
}

async function register(request: Request, env: Env) {
  const body = await request.json().catch(() => undefined) as { username?: unknown; password?: unknown; offlineUuid?: unknown } | undefined
  const username = normalizeUsername(body?.username)
  const offlineUuid = normalizeUuid(body?.offlineUuid)
  if (!username || !offlineUuid || typeof body?.password !== 'string' || body.password.length < 8) {
    return error('Username, UUID, and a password of at least 8 characters are required.', 400, env, request)
  }
  const normalized = username.toLowerCase()
  const passwordHash = await createPasswordHash(body.password)
  const id = crypto.randomUUID()
  try {
    const accounts = await supabase<AccountRow[]>(env, 'offline_accounts', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ id, username, normalized_username: normalized, offline_uuid: offlineUuid, password_hash: passwordHash }),
    })
    return response({ account: accountView(accounts[0]) }, 201, env, request)
  } catch (cause) {
    if (!(cause instanceof SupabaseError) || cause.status !== 409) throw cause
    return error('That username or offline UUID is already registered.', 409, env, request)
  }
}

async function login(request: Request, env: Env) {
  const body = await request.json().catch(() => undefined) as { username?: unknown; password?: unknown } | undefined
  const username = normalizeUsername(body?.username)
  if (!username || typeof body?.password !== 'string') return error('Invalid username or password.', 401, env, request)
  const accounts = await supabase<AccountRow[]>(env, `offline_accounts?normalized_username=eq.${encodeURIComponent(username.toLowerCase())}&select=*`)
  const account = accounts[0]
  // Keep the response identical for unknown usernames and bad passwords.
  if (!account || !(await verifyPassword(body.password, account.password_hash))) {
    return error('Invalid username or password.', 401, env, request)
  }
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32))
  const token = toBase64Url(tokenBytes)
  await supabase(env, 'offline_sessions', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ id: crypto.randomUUID(), account_id: account.id, token_hash: await sha256(token), expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString() }),
  })
  return response({ token, expiresIn: SESSION_TTL_SECONDS, account: accountView(account) }, 200, env, request)
}

async function updateSkin(request: Request, env: Env) {
  const account = await getAccountForSession(request, env)
  if (!account) return error('Unauthorized.', 401, env, request)
  if (request.headers.get('content-type')?.split(';')[0].toLowerCase() !== 'image/png') return error('Skin must be a PNG image.', 415, env, request)
  const image = await request.arrayBuffer()
  if (image.byteLength > 1024 * 1024 || !isMinecraftSkin(new Uint8Array(image))) return error('Skin must be a 64x64 PNG smaller than 1 MiB.', 400, env, request)
  const skinUrl = await uploadSkin(env, account, image)
  const requestedModel = request.headers.get('x-skin-model')
  const skinModel = requestedModel === 'slim' ? 'slim' : 'steve'
  const updated = await supabase<AccountRow[]>(env, `offline_accounts?id=eq.${encodeURIComponent(account.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ skin_url: skinUrl, skin_model: skinModel, updated_at: new Date().toISOString() }),
  })
  return response({ account: accountView(updated[0] || { ...account, skin_url: skinUrl }) }, 200, env, request)
}

async function updateCape(request: Request, env: Env) {
  const account = await getAccountForSession(request, env)
  if (!account) return error('Unauthorized.', 401, env, request)
  if (request.headers.get('content-type')?.split(';')[0].toLowerCase() !== 'image/png') return error('Cape must be a PNG image.', 415, env, request)
  const image = await request.arrayBuffer()
  if (image.byteLength > 1024 * 1024 || !isMinecraftCape(new Uint8Array(image))) return error('Cape must be a 64x32 PNG smaller than 1 MiB.', 400, env, request)
  const capeUrl = await uploadSkin(env, account, image, 'capes')
  const updated = await supabase<AccountRow[]>(env, `offline_accounts?id=eq.${encodeURIComponent(account.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ cape_url: capeUrl, updated_at: new Date().toISOString() }),
  })
  return response({ account: accountView(updated[0] || { ...account, cape_url: capeUrl }) }, 200, env, request)
}

async function removeCape(request: Request, env: Env) {
  const account = await getAccountForSession(request, env)
  if (!account) return error('Unauthorized.', 401, env, request)
  const updated = await supabase<AccountRow[]>(env, `offline_accounts?id=eq.${encodeURIComponent(account.id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({ cape_url: null, updated_at: new Date().toISOString() }),
  })
  return response({ account: accountView(updated[0] || { ...account, cape_url: null }) }, 200, env, request)
}

async function profile(request: Request, env: Env, uuid: string) {
  const result = await findAccountByUuid(env, uuid)
  if (!result) return error('Profile not found.', 404, env, request)
  const { account } = result
  return response({ id: account.offline_uuid.replaceAll('-', ''), name: account.username, textures: account.skin_url ? { SKIN: { url: account.skin_url, metadata: { model: account.skin_model } } } : {} }, 200, env, request)
}

async function yggdrasilProfileResponse(request: Request, env: Env, uuid: string) {
  const result = await findAccountByUuid(env, uuid)
  return result ? response(yggdrasilProfile(result.account, result.profileId), 200, env, request) : response({}, 204, env, request)
}

async function yggdrasilHasJoined(request: Request, env: Env) {
  const username = new URL(request.url).searchParams.get('username')
  const account = username ? await findAccountByUsername(env, username) : undefined
  return account ? response(yggdrasilProfile(account), 200, env, request) : response({}, 204, env, request)
}

async function legacySkin(request: Request, env: Env, username: string) {
  const account = await findAccountByUsername(env, username)
  if (!account?.skin_url) return new Response(null, { status: 204 })
  const result = await fetch(account.skin_url)
  if (!result.ok) return new Response(null, { status: 204 })
  const headers = new Headers({
    // Minecraft/CustomSkinLoader must see a skin change immediately after it
    // is equipped; do not let a proxy or browser retain the old PNG.
    'cache-control': 'no-store',
    'content-type': result.headers.get('content-type') || 'image/png',
  })
  return new Response(result.body, { status: 200, headers })
}

async function legacyCape(request: Request, env: Env, username: string) {
  const account = await findAccountByUsername(env, username)
  if (!account?.cape_url) return new Response(null, { status: 204 })
  const result = await fetch(account.cape_url)
  if (!result.ok) return new Response(null, { status: 204 })
  return new Response(result.body, {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': result.headers.get('content-type') || 'image/png',
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return response({}, 204, env, request)
    const url = new URL(request.url)
    console.log(`[offline-auth] ${request.method} ${url.pathname}`)
    try {
      const apiPath = yggdrasilPath(url.pathname)
      if (apiPath === '/' && request.method === 'GET') return response(yggdrasilMetadata(env), 200, env, request)
      const legacySkinMatch = apiPath.match(/^\/skins\/MinecraftSkins\/([^/]+)\.png$/i)
      if (legacySkinMatch && request.method === 'GET') return await legacySkin(request, env, decodeURIComponent(legacySkinMatch[1]))
      const legacyCapeMatch = apiPath.match(/^\/skins\/MinecraftCapes\/([^/]+)\.png$/i)
      if (legacyCapeMatch && request.method === 'GET') return await legacyCape(request, env, decodeURIComponent(legacyCapeMatch[1]))
      const yggProfileMatch = apiPath.match(/^\/sessionserver\/session\/minecraft\/profile\/([^/]+)$/)
      if (yggProfileMatch && request.method === 'GET') return await yggdrasilProfileResponse(request, env, yggProfileMatch[1])
      if (apiPath === '/sessionserver/session/minecraft/hasJoined' && request.method === 'GET') return await yggdrasilHasJoined(request, env)
      if (apiPath === '/sessionserver/session/minecraft/join' && request.method === 'POST') return response({}, 204, env, request)
      if (url.pathname === '/health') return response({ ok: true }, 200, env, request)
      if (url.pathname === '/v1/accounts/register' && request.method === 'POST') return await register(request, env)
      if (url.pathname === '/v1/accounts/login' && request.method === 'POST') return await login(request, env)
      if (url.pathname === '/v1/accounts/me' && request.method === 'GET') {
        const refreshed = await refreshSession(request, env)
        return refreshed ? response({ account: accountView(refreshed.account), expiresAt: refreshed.expiresAt }, 200, env, request) : error('Unauthorized.', 401, env, request)
      }
      if (url.pathname === '/v1/accounts/me/skin' && request.method === 'PUT') return await updateSkin(request, env)
      if (url.pathname === '/v1/accounts/me/cape' && request.method === 'PUT') return await updateCape(request, env)
      if (url.pathname === '/v1/accounts/me/cape' && request.method === 'DELETE') return await removeCape(request, env)
      const profileMatch = url.pathname.match(/^\/v1\/profiles\/([^/]+)$/)
      if (profileMatch && request.method === 'GET') return await profile(request, env, profileMatch[1])
      return error('Not found.', 404, env, request)
    } catch (cause) {
      console.error(`[offline-auth] ${request.method} ${url.pathname} failed`, cause)
      return error('Backend temporarily unavailable.', 503, env, request)
    }
  },
} satisfies ExportedHandler<Env>
