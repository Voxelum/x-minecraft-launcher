// Vardrynn account routes (phase 6). Storage is Cloudflare D1 (`env.DB`, see schema.sql).
// Sign-in: Microsoft (launcher token exchange), Google and Discord (browser PKCE flow).
// Tokens are opaque Bearer tokens; only their SHA-256 hashes are stored.
const ACCESS_TTL_MS = 15 * 60_000
const REFRESH_TTL_MS = 30 * 86_400_000
const TRANSACTION_TTL_MS = 10 * 60_000
const CALLBACK_PATH = '/commercial-auth'
const SCOPES = ['account']

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
const fail = (status, error) => Object.assign(new Error(error), { status, code: error })

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const sha256 = (text) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
const hashToken = async (token) => b64url(await sha256(token))
const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)))

const PROVIDERS = {
  google: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: 'openid profile',
    profile: async (accessToken) => {
      const r = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${accessToken}` } })
      if (!r.ok) throw fail(502, 'provider_unavailable')
      const p = await r.json()
      return { subject: String(p.sub ?? ''), displayName: p.name }
    },
    credentials: (env) => [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET],
  },
  discord: {
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    scope: 'identify',
    // Discord matches redirect URIs exactly, so it cannot follow the launcher's fallback ports.
    // It returns to this service, which forwards to the launcher's loopback address.
    relay: true,
    profile: async (accessToken) => {
      const r = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${accessToken}` } })
      if (!r.ok) throw fail(502, 'provider_unavailable')
      const p = await r.json()
      return { subject: String(p.id ?? ''), displayName: p.global_name || p.username }
    },
    credentials: (env) => [env.DISCORD_CLIENT_ID, env.DISCORD_CLIENT_SECRET],
  },
}

const nowIso = (now) => new Date(now).toISOString()
const relayUri = (origin, provider) => `${origin}/v1/auth/${provider}/callback`
const providerRedirect = (config, origin, provider, launcherUri) => config.relay ? relayUri(origin, provider) : launcherUri

async function createSession(env, accountId, now) {
  const accessToken = randomToken()
  const refreshToken = randomToken()
  const session = {
    sessionId: crypto.randomUUID(),
    accountId,
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    scopes: SCOPES,
    issuedAt: nowIso(now),
    expiresAt: nowIso(now + ACCESS_TTL_MS),
  }
  await env.DB.prepare(
    'INSERT INTO sessions (id, account_id, access_hash, refresh_hash, scopes, issued_at, access_expires_at, refresh_expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(session.sessionId, accountId, await hashToken(accessToken), await hashToken(refreshToken), SCOPES.join(' '),
    session.issuedAt, session.expiresAt, nowIso(now + REFRESH_TTL_MS)).run()
  return session
}

async function authenticate(request, env, now) {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')
  if (!match) throw fail(401, 'unauthorized')
  const row = await env.DB.prepare(
    `SELECT s.id AS session_id, s.account_id FROM sessions s JOIN accounts a ON a.id = s.account_id
     WHERE s.access_hash = ? AND s.revoked_at IS NULL AND s.access_expires_at > ? AND a.status = 'active'`,
  ).bind(await hashToken(match[1]), nowIso(now)).first()
  if (!row) throw fail(401, 'unauthorized')
  return { sessionId: row.session_id, accountId: row.account_id }
}

async function accountSession(env, accountId, bindingDisposition, now) {
  const account = await env.DB.prepare('SELECT id, status, created_at FROM accounts WHERE id = ?').bind(accountId).first()
  const identities = await listIdentities(env, accountId)
  return {
    account: { accountId: account.id, status: account.status, createdAt: account.created_at },
    identities,
    session: await createSession(env, accountId, now),
    bindingDisposition,
  }
}

async function listIdentities(env, accountId) {
  const { results } = await env.DB.prepare(
    'SELECT provider, display_name, linked_by, linked_at FROM identities WHERE account_id = ? ORDER BY linked_at',
  ).bind(accountId).all()
  return results.map((r) => ({ provider: r.provider, displayName: r.display_name ?? undefined, linkedBy: r.linked_by, linkedAt: r.linked_at }))
}

// Resolve a verified provider identity to an account. `current` is set when a signed-in user links it.
async function resolveIdentity(env, { provider, subject, displayName, linkedBy }, current, now) {
  if (!subject) throw fail(502, 'provider_unavailable')
  const existing = await env.DB.prepare('SELECT account_id FROM identities WHERE provider = ? AND subject = ?').bind(provider, subject).first()
  if (existing) {
    // Merging two Vardrynn accounts is not supported; report the conflict instead of guessing.
    if (current && existing.account_id !== current.accountId) throw fail(409, 'identity_conflict')
    return accountSession(env, existing.account_id, current ? 'linked' : 'restored', now)
  }
  const at = nowIso(now)
  if (current) {
    await env.DB.prepare('INSERT INTO identities (provider, subject, account_id, display_name, linked_by, linked_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(provider, subject, current.accountId, displayName ?? null, linkedBy, at).run()
    return accountSession(env, current.accountId, 'linked', now)
  }
  const accountId = crypto.randomUUID()
  await env.DB.batch([
    env.DB.prepare("INSERT INTO accounts (id, status, created_at) VALUES (?, 'active', ?)").bind(accountId, at),
    env.DB.prepare('INSERT INTO identities (provider, subject, account_id, display_name, linked_by, linked_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(provider, subject, accountId, displayName ?? null, linkedBy, at),
  ])
  return accountSession(env, accountId, 'created', now)
}

function validateAuthorizeRequest(body) {
  let uri
  try { uri = new URL(body.redirectUri) } catch { throw fail(400, 'invalid_request') }
  const loopback = uri.protocol === 'http:' && uri.hostname === '127.0.0.1' && uri.pathname === CALLBACK_PATH && !uri.username && !uri.password && !uri.search && !uri.hash
  if (!loopback) throw fail(400, 'invalid_redirect_uri')
  if (typeof body.state !== 'string' || !/^[\w-]{16,256}$/.test(body.state)) throw fail(400, 'invalid_request')
  if (typeof body.codeChallenge !== 'string' || !/^[\w-]{43}$/.test(body.codeChallenge)) throw fail(400, 'invalid_request')
  return { state: body.state, redirectUri: uri.href, codeChallenge: body.codeChallenge }
}

async function beginAuthorization(env, origin, provider, body, accountId, now) {
  const config = PROVIDERS[provider]
  const [clientId, secret] = config.credentials(env)
  if (!clientId || !secret) throw fail(503, 'provider_unconfigured')
  const req = validateAuthorizeRequest(body)
  const id = crypto.randomUUID()
  const expiresAt = nowIso(now + TRANSACTION_TTL_MS)
  await env.DB.prepare('DELETE FROM oauth_transactions WHERE expires_at < ?').bind(nowIso(now - 86_400_000)).run()
  await env.DB.prepare('INSERT INTO oauth_transactions (id, provider, state, redirect_uri, code_challenge, account_id, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, provider, req.state, req.redirectUri, req.codeChallenge, accountId ?? null, expiresAt).run()
  const url = new URL(config.authorize)
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: providerRedirect(config, origin, provider, req.redirectUri), response_type: 'code', scope: config.scope,
    state: req.state, code_challenge: req.codeChallenge, code_challenge_method: 'S256',
  }).toString()
  return { transactionId: id, authorizationUrl: url.href, expiresAt }
}

async function completeAuthorization(env, origin, provider, body, current, now) {
  const config = PROVIDERS[provider]
  const [clientId, secret] = config.credentials(env)
  if (!clientId || !secret) throw fail(503, 'provider_unconfigured')
  if (![body.transactionId, body.code, body.state, body.codeVerifier].every((v) => typeof v === 'string' && v)) throw fail(400, 'invalid_request')
  const tx = await env.DB.prepare('SELECT * FROM oauth_transactions WHERE id = ? AND provider = ?').bind(body.transactionId, provider).first()
  if (!tx || tx.used_at || tx.expires_at <= nowIso(now) || tx.state !== body.state) throw fail(400, 'invalid_transaction')
  if (tx.account_id !== (current?.accountId ?? null)) throw fail(400, 'invalid_transaction')
  if (b64url(await sha256(body.codeVerifier)) !== tx.code_challenge) throw fail(400, 'invalid_transaction')
  // Single use: only one request can flip used_at.
  const claimed = await env.DB.prepare('UPDATE oauth_transactions SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(nowIso(now), tx.id).run()
  if (claimed.meta?.changes !== 1) throw fail(400, 'invalid_transaction')
  const tokenResponse = await fetch(config.token, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code: body.code, redirect_uri: providerRedirect(config, origin, provider, tx.redirect_uri),
      client_id: clientId, client_secret: secret, code_verifier: body.codeVerifier,
    }),
  })
  if (!tokenResponse.ok) throw fail(401, 'provider_rejected')
  const { access_token: accessToken } = await tokenResponse.json()
  if (!accessToken) throw fail(401, 'provider_rejected')
  const profile = await config.profile(accessToken)
  return resolveIdentity(env, { provider, ...profile, linkedBy: 'web_link' }, current, now)
}

// Microsoft: the launcher sends a Graph access token it obtained for Vardrynn's application.
async function microsoftExchange(env, body, current, now) {
  if (!env.MICROSOFT_CLIENT_ID) throw fail(503, 'provider_unconfigured')
  if (typeof body.credential !== 'string' || !body.credential) throw fail(400, 'invalid_request')
  // Reject tokens minted for another application when the token is a readable JWT.
  const parts = body.credential.split('.')
  if (parts.length === 3) {
    try {
      const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      const app = claims.appid ?? claims.azp
      if (app && app !== env.MICROSOFT_CLIENT_ID) throw fail(401, 'provider_rejected')
    } catch (e) {
      if (e.status) throw e
    }
  }
  const r = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName', { headers: { authorization: `Bearer ${body.credential}` } })
  if (r.status === 401 || r.status === 403) throw fail(401, 'provider_rejected')
  if (!r.ok) throw fail(502, 'provider_unavailable')
  const profile = await r.json()
  return resolveIdentity(env, {
    provider: 'microsoft', subject: String(profile.id ?? ''), displayName: profile.displayName,
    linkedBy: current ? 'launcher_link' : 'launcher_bootstrap',
  }, current, now)
}

// Forward a relayed provider response to the launcher that started the transaction.
// Only a stored, validated loopback URI is ever a target; the code is useless without the PKCE verifier.
async function relayCallback(env, provider, url, now) {
  const params = url.searchParams
  const state = params.get('state')
  if (!state) throw fail(400, 'invalid_transaction')
  const tx = await env.DB.prepare(
    'SELECT redirect_uri FROM oauth_transactions WHERE provider = ? AND state = ? AND used_at IS NULL AND expires_at > ? ORDER BY expires_at DESC LIMIT 1',
  ).bind(provider, state, nowIso(now)).first()
  if (!tx) throw fail(400, 'invalid_transaction')
  const target = new URL(tx.redirect_uri)
  for (const key of ['code', 'state', 'error', 'error_description']) {
    const value = params.get(key)
    if (value !== null) target.searchParams.set(key, value)
  }
  return new Response(null, { status: 302, headers: { location: target.href, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })
}

async function refresh(request, env, now) {
  const body = await request.json().catch(() => ({}))
  if (typeof body.sessionId !== 'string' || typeof body.refreshToken !== 'string') throw fail(400, 'invalid_request')
  const s = await env.DB.prepare(
    `SELECT s.*, a.status FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.id = ?`,
  ).bind(body.sessionId).first()
  if (!s || s.revoked_at || s.status !== 'active' || s.refresh_expires_at <= nowIso(now)) throw fail(401, 'unauthorized')
  if (s.refresh_hash !== await hashToken(body.refreshToken)) {
    // A rotated-out refresh token was replayed: assume theft and end the session.
    await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(nowIso(now), s.id).run()
    throw fail(401, 'unauthorized')
  }
  const accessToken = randomToken()
  const refreshToken = randomToken()
  const expiresAt = nowIso(now + ACCESS_TTL_MS)
  const swapped = await env.DB.prepare('UPDATE sessions SET access_hash = ?, refresh_hash = ?, access_expires_at = ?, refresh_expires_at = ? WHERE id = ? AND refresh_hash = ?')
    .bind(await hashToken(accessToken), await hashToken(refreshToken), expiresAt, nowIso(now + REFRESH_TTL_MS), s.id, s.refresh_hash).run()
  if (swapped.meta?.changes !== 1) throw fail(401, 'unauthorized')
  return json({ session: {
    sessionId: s.id, accountId: s.account_id, accessToken, refreshToken, tokenType: 'Bearer',
    scopes: s.scopes.split(' '), issuedAt: s.issued_at, expiresAt,
  } })
}

async function route(request, env, pathname, now) {
  const method = request.method
  const url = new URL(request.url)
  const origin = env.PUBLIC_ORIGIN || url.origin
  const body = () => request.json().catch(() => { throw fail(400, 'invalid_request') })
  let m

  if (method === 'GET' && (m = /^\/v1\/auth\/(google|discord)\/authorize$/.exec(pathname))) {
    const q = url.searchParams
    return json(await beginAuthorization(env, origin, m[1], { state: q.get('state'), redirectUri: q.get('redirectUri'), codeChallenge: q.get('codeChallenge') }, undefined, now))
  }
  if (method === 'GET' && (m = /^\/v1\/auth\/(discord)\/callback$/.exec(pathname))) {
    return relayCallback(env, m[1], url, now)
  }
  if (method === 'POST' && (m = /^\/v1\/auth\/(google|discord)\/exchange$/.exec(pathname))) {
    return json(await completeAuthorization(env, origin, m[1], await body(), undefined, now))
  }
  if (method === 'POST' && pathname === '/v1/auth/microsoft/launcher-exchange') {
    const current = request.headers.has('authorization') ? await authenticate(request, env, now) : undefined
    return json(await microsoftExchange(env, await body(), current, now))
  }
  if (method === 'POST' && pathname === '/v1/sessions/refresh') return refresh(request, env, now)

  const auth = await authenticate(request, env, now)
  if (method === 'GET' && pathname === '/v1/sessions/current') {
    const s = await env.DB.prepare('SELECT * FROM sessions WHERE id = ?').bind(auth.sessionId).first()
    return json({ sessionId: s.id, accountId: s.account_id, scopes: s.scopes.split(' '), issuedAt: s.issued_at, expiresAt: s.access_expires_at })
  }
  if (method === 'POST' && pathname === '/v1/sessions/revoke') {
    const b = await body()
    if (b.all === true) {
      await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL').bind(nowIso(now), auth.accountId).run()
    } else {
      if (b.sessionId !== auth.sessionId) throw fail(403, 'forbidden')
      await env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE id = ?').bind(nowIso(now), auth.sessionId).run()
    }
    return new Response(null, { status: 204 })
  }
  if (method === 'GET' && pathname === '/v1/account') {
    const a = await env.DB.prepare('SELECT id, status, created_at FROM accounts WHERE id = ?').bind(auth.accountId).first()
    return json({ accountId: a.id, status: a.status, createdAt: a.created_at })
  }
  if (method === 'DELETE' && pathname === '/v1/account') {
    // Deletion is immediate: identities are erased so the same provider account starts fresh.
    await env.DB.batch([
      env.DB.prepare("UPDATE accounts SET status = 'deleted', deleted_at = ? WHERE id = ?").bind(nowIso(now), auth.accountId),
      env.DB.prepare('DELETE FROM identities WHERE account_id = ?').bind(auth.accountId),
      env.DB.prepare('UPDATE sessions SET revoked_at = ? WHERE account_id = ? AND revoked_at IS NULL').bind(nowIso(now), auth.accountId),
    ])
    return new Response(null, { status: 204 })
  }
  if (method === 'GET' && pathname === '/v1/account/identities') return json(await listIdentities(env, auth.accountId))
  if (method === 'POST' && (m = /^\/v1\/account\/identities\/(google|discord)\/authorize$/.exec(pathname))) {
    return json(await beginAuthorization(env, origin, m[1], await body(), auth.accountId, now))
  }
  if (method === 'POST' && (m = /^\/v1\/account\/identities\/(google|discord)\/complete$/.exec(pathname))) {
    await completeAuthorization(env, origin, m[1], await body(), auth, now)
    return json({ bindingDisposition: 'linked' })
  }
  return undefined
}

// Unauthenticated routes create rows and call providers, so they are limited per client address.
// The `AUTH_RATE_LIMITER` binding is a Workers rate limiter; without it requests are not limited.
const RATE_LIMITED = /^\/v1\/(auth\/|sessions\/refresh$)/

async function rateLimited(request, env, pathname) {
  if (!env.AUTH_RATE_LIMITER || !RATE_LIMITED.test(pathname)) return false
  const key = request.headers.get('cf-connecting-ip') || 'unknown'
  const { success } = await env.AUTH_RATE_LIMITER.limit({ key })
  return !success
}

/** Returns a Response for account routes, or undefined when the path is not one. */
export async function handleAccountRoute(request, env, pathname, now = Date.now()) {
  if (!/^\/v1\/(auth|account|sessions)(\/|$)/.test(pathname)) return undefined
  const requestId = crypto.randomUUID()
  if (!env.DB) return json({ error: 'accounts_unconfigured', requestId }, 503)
  try {
    if (await rateLimited(request, env, pathname)) {
      const response = json({ error: 'rate_limited', requestId }, 429)
      response.headers.set('retry-after', '60')
      return response
    }
    return (await route(request, env, pathname, now)) ?? json({ error: 'not_found', requestId }, 404)
  } catch (e) {
    if (e?.status) return json({ error: e.code, requestId }, e.status)
    return json({ error: 'internal_error', requestId }, 500)
  }
}
