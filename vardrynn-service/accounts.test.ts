import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import worker from './worker.js'

// Minimal D1 surface over node:sqlite.
function d1() {
  const db = new DatabaseSync(':memory:')
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'))
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args as any[]).changes) } }),
    first: async () => (db.prepare(sql).get(...args as any[]) as any) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...args as any[]) as any[] }),
  })
  return { prepare: (sql: string) => stmt(sql), batch: async (list: any[]) => { for (const s of list) await s.run(); return [] } }
}

const b64 = (b: Buffer) => b.toString('base64url')
const verifier = b64(Buffer.alloc(32, 7))
const challenge = b64(createHash('sha256').update(verifier).digest())
const redirectUri = 'http://127.0.0.1:25555/commercial-auth'
const state = 'a'.repeat(32)
const env = () => ({
  DB: d1(), GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsec',
  DISCORD_CLIENT_ID: 'did', DISCORD_CLIENT_SECRET: 'dsec', MICROSOFT_CLIENT_ID: 'ms-app',
})
const call = (e: any, method: string, path: string, body?: unknown, token?: string) =>
  worker.fetch(new Request(`https://api.example.com${path}`, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }), e)

let providerUsers: Record<string, any>
beforeEach(() => {
  providerUsers = { google: { sub: 'g-1', name: 'Gee' }, discord: { id: 'd-1', username: 'dee' }, graph: { id: 'm-1', displayName: 'Em' } }
  vi.stubGlobal('fetch', vi.fn(async (url: any) => {
    const u = String(url)
    if (u.includes('oauth2.googleapis.com/token') || u.includes('discord.com/api/oauth2/token')) return Response.json({ access_token: 'pt' })
    if (u.includes('openidconnect')) return Response.json(providerUsers.google)
    if (u.includes('users/@me')) return Response.json(providerUsers.discord)
    if (u.includes('graph.microsoft.com')) return Response.json(providerUsers.graph)
    return new Response('?', { status: 500 })
  }))
})
afterEach(() => vi.unstubAllGlobals())

async function browserSignIn(e: any, provider: string, token?: string) {
  const path = token ? `/v1/account/identities/${provider}/authorize` : `/v1/auth/${provider}/authorize?${new URLSearchParams({ state, redirectUri, codeChallenge: challenge })}`
  const begin = await (token ? call(e, 'POST', path, { state, redirectUri, codeChallenge: challenge }, token) : call(e, 'GET', path))
  expect(begin.status).toBe(200)
  const tx = await begin.json() as any
  const done = await call(e, 'POST', token ? `/v1/account/identities/${provider}/complete` : `/v1/auth/${provider}/exchange`,
    { transactionId: tx.transactionId, code: 'c', state, codeVerifier: verifier }, token)
  return { tx, done }
}

describe('accounts', () => {
  it('is unconfigured without a database', async () => {
    expect((await call({}, 'GET', '/v1/account')).status).toBe(503)
  })

  it('signs in with Google, then restores the same account', async () => {
    const e = env()
    const { tx, done } = await browserSignIn(e, 'google')
    expect(new URL(tx.authorizationUrl).searchParams.get('code_challenge')).toBe(challenge)
    const first = await done.json() as any
    expect(first.bindingDisposition).toBe('created')
    const again = await (await browserSignIn(e, 'google')).done.json() as any
    expect(again.bindingDisposition).toBe('restored')
    expect(again.account.accountId).toBe(first.account.accountId)
    const account = await call(e, 'GET', '/v1/account', undefined, first.session.accessToken)
    expect((await account.json() as any).status).toBe('active')
  })

  it('rejects a replayed transaction, a wrong verifier and a non-loopback redirect', async () => {
    const e = env()
    const { tx } = await browserSignIn(e, 'discord')
    const replay = await call(e, 'POST', '/v1/auth/discord/exchange', { transactionId: tx.transactionId, code: 'c', state, codeVerifier: verifier })
    expect(replay.status).toBe(400)
    const begin = await (await call(e, 'GET', `/v1/auth/discord/authorize?${new URLSearchParams({ state, redirectUri, codeChallenge: challenge })}`)).json() as any
    const bad = await call(e, 'POST', '/v1/auth/discord/exchange', { transactionId: begin.transactionId, code: 'c', state, codeVerifier: 'x'.repeat(43) })
    expect(bad.status).toBe(400)
    const evil = await call(e, 'GET', `/v1/auth/google/authorize?${new URLSearchParams({ state, redirectUri: 'https://evil.example/commercial-auth', codeChallenge: challenge })}`)
    expect(evil.status).toBe(400)
  })

  it('signs in with Microsoft and links Discord to it', async () => {
    const e = env()
    const ms = await (await call(e, 'POST', '/v1/auth/microsoft/launcher-exchange', { credential: 'graph-token' })).json() as any
    expect(ms.bindingDisposition).toBe('created')
    const link = await browserSignIn(e, 'discord', ms.session.accessToken)
    expect(await link.done.json()).toEqual({ bindingDisposition: 'linked' })
    const ids = await (await call(e, 'GET', '/v1/account/identities', undefined, ms.session.accessToken)).json() as any[]
    expect(ids.map((i) => i.provider).sort()).toEqual(['discord', 'microsoft'])
    // Signing in with Discord alone now reaches the same account.
    const viaDiscord = await (await browserSignIn(e, 'discord')).done.json() as any
    expect(viaDiscord.account.accountId).toBe(ms.account.accountId)
  })

  it('reports a conflict instead of merging two accounts', async () => {
    const e = env()
    const g = await (await browserSignIn(e, 'google')).done.json() as any
    const ms = await (await call(e, 'POST', '/v1/auth/microsoft/launcher-exchange', { credential: 'graph-token' })).json() as any
    const conflict = await call(e, 'POST', '/v1/auth/microsoft/launcher-exchange', { credential: 'graph-token' }, g.session.accessToken)
    expect(conflict.status).toBe(409)
    expect((await conflict.json() as any).error).toBe('identity_conflict')
    expect(ms.account.accountId).not.toBe(g.account.accountId)
  })

  it('rejects a Microsoft token minted for another application', async () => {
    const claims = Buffer.from(JSON.stringify({ appid: 'someone-else' })).toString('base64url')
    const r = await call(env(), 'POST', '/v1/auth/microsoft/launcher-exchange', { credential: `h.${claims}.s` })
    expect(r.status).toBe(401)
  })

  it('rotates refresh tokens and revokes the session on replay', async () => {
    const e = env()
    const s = (await (await browserSignIn(e, 'google')).done.json() as any).session
    const refreshed = await (await call(e, 'POST', '/v1/sessions/refresh', { sessionId: s.sessionId, refreshToken: s.refreshToken }, s.accessToken)).json() as any
    expect(refreshed.session.accessToken).not.toBe(s.accessToken)
    expect((await call(e, 'GET', '/v1/account', undefined, s.accessToken)).status).toBe(401)
    expect((await call(e, 'GET', '/v1/account', undefined, refreshed.session.accessToken)).status).toBe(200)
    const replay = await call(e, 'POST', '/v1/sessions/refresh', { sessionId: s.sessionId, refreshToken: s.refreshToken })
    expect(replay.status).toBe(401)
    expect((await call(e, 'GET', '/v1/account', undefined, refreshed.session.accessToken)).status).toBe(401)
  })

  it('signs out and deletes the account', async () => {
    const e = env()
    const a = await (await browserSignIn(e, 'google')).done.json() as any
    const t = a.session.accessToken
    expect((await call(e, 'POST', '/v1/sessions/revoke', { sessionId: a.session.sessionId, all: false }, t)).status).toBe(204)
    expect((await call(e, 'GET', '/v1/account', undefined, t)).status).toBe(401)
    const b = await (await browserSignIn(e, 'google')).done.json() as any
    expect((await call(e, 'DELETE', '/v1/account', undefined, b.session.accessToken)).status).toBe(204)
    expect((await call(e, 'GET', '/v1/account', undefined, b.session.accessToken)).status).toBe(401)
    // The provider identity is free again and starts a new account.
    const c = await (await browserSignIn(e, 'google')).done.json() as any
    expect(c.bindingDisposition).toBe('created')
    expect(c.account.accountId).not.toBe(b.account.accountId)
  })

  it('requires a token for account routes', async () => {
    expect((await call(env(), 'GET', '/v1/account')).status).toBe(401)
  })
})
