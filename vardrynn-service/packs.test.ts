import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  return { db, prepare: (sql: string) => stmt(sql), batch: async (list: any[]) => { for (const s of list) await s.run(); return [] } }
}

const tokenHash = (token: string) => createHash('sha256').update(token).digest('base64url')
function signIn(e: any, accountId: string) {
  const token = `token-${accountId}`
  const later = new Date(Date.now() + 600_000).toISOString()
  e.DB.db.prepare("INSERT INTO accounts (id, created_at) VALUES (?, '2026-11-06T00:00:00Z')").run(accountId)
  e.DB.db.prepare('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)')
    .run(`s-${accountId}`, accountId, tokenHash(token), tokenHash(`r-${token}`), 'account', '2026-11-06T00:00:00Z', later, later)
  return token
}

const env = (extra: Record<string, unknown> = {}) => ({ DB: d1(), PACK_PUBLISHER_ACCOUNT_IDS: 'owner, other', ...extra })
const call = (e: any, method: string, path: string, body?: unknown, token?: string) =>
  worker.fetch(new Request(`https://api.example.com${path}`, {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  }), e)

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')
const manifest = (files: unknown[] = [
  { path: 'mods/sodium.jar', hashes: { sha1: sha1('a') }, modrinth: { projectId: 'AANobbMI', versionId: 'v1' } },
  { path: 'mods/jei.jar', hashes: { sha1: sha1('b') }, curseforge: { projectId: 238222, fileId: 1 } },
  { path: 'config/a.toml', hashes: { sha1: sha1('c') }, downloads: [`https://api.example.com/v1/packs/files/${sha1('c')}`] },
]) => ({ runtime: { minecraft: '1.21.1', fabricLoader: '0.16.0', forge: '' }, files })

async function publishPack(e: any, token: string) {
  expect((await call(e, 'PUT', '/v1/packs/folded', { title: 'Folded Multiverse', summary: 'Mixed sources' }, token)).status).toBe(201)
  const published = await call(e, 'POST', '/v1/packs/folded/versions', { version: '1.0.0', changelog: 'First', manifest: manifest() }, token)
  expect(published.status).toBe(201)
  return (await published.json() as any).version
}

describe('pack routes', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('publishes a pack whose files come from both sites and reads it back publicly', async () => {
    const e = env()
    const token = signIn(e, 'owner')
    const version = await publishPack(e, token)
    expect(version).toMatchObject({ version: '1.0.0', minecraft: '1.21.1', loaders: ['fabricLoader'] })

    const list = await (await call(e, 'GET', '/v1/packs')).json() as any
    expect(list.packs).toEqual([expect.objectContaining({ slug: 'folded', title: 'Folded Multiverse', latestVersion: expect.objectContaining({ id: version.id }) })])
    const detail = await (await call(e, 'GET', '/v1/packs/folded')).json() as any
    expect(detail.pack.versions.map((v: any) => v.version)).toEqual(['1.0.0'])
    const full = await (await call(e, 'GET', `/v1/packs/folded/versions/${version.id}`)).json() as any
    expect(full.version.manifest).toEqual(manifest())
  })

  it('lists the newest version and filters by title', async () => {
    const e = env()
    const token = signIn(e, 'owner')
    await publishPack(e, token)
    await call(e, 'POST', '/v1/packs/folded/versions', { version: '1.1.0', manifest: manifest() }, token)
    const list = await (await call(e, 'GET', '/v1/packs')).json() as any
    expect(list.packs[0].latestVersion.version).toBe('1.1.0')
    expect((await (await call(e, 'GET', '/v1/packs?q=multi')).json() as any).packs).toHaveLength(1)
    expect((await (await call(e, 'GET', '/v1/packs?q=cobble')).json() as any).packs).toHaveLength(0)
    expect((await (await call(e, 'GET', '/v1/packs?q=%25')).json() as any).packs).toHaveLength(0)
  })

  it('keeps a pack hidden until its first version', async () => {
    const e = env()
    const token = signIn(e, 'owner')
    const created = await call(e, 'PUT', '/v1/packs/draft', { title: 'Draft' }, token)
    expect((await created.json() as any).pack.versions).toEqual([])
    expect((await call(e, 'GET', '/v1/packs/draft')).status).toBe(404)
    expect((await (await call(e, 'GET', '/v1/packs')).json() as any).packs).toEqual([])
  })

  it('only lets listed publishers write, and only to their own packs', async () => {
    const e = env()
    const owner = signIn(e, 'owner')
    const other = signIn(e, 'other')
    const stranger = signIn(e, 'stranger')
    await publishPack(e, owner)
    expect((await call(e, 'PUT', '/v1/packs/folded', { title: 'x' })).status).toBe(401)
    expect((await call(e, 'PUT', '/v1/packs/new', { title: 'x' }, stranger)).status).toBe(403)
    expect((await call(e, 'PUT', '/v1/packs/folded', { title: 'x' }, other)).status).toBe(403)
    expect((await call(e, 'POST', '/v1/packs/folded/versions', { version: '2', manifest: manifest() }, other)).status).toBe(403)
    expect((await call(e, 'POST', '/v1/packs/missing/versions', { version: '2', manifest: manifest() }, owner)).status).toBe(404)
    const noPublishers = { ...e, PACK_PUBLISHER_ACCOUNT_IDS: undefined }
    expect((await call(noPublishers, 'PUT', '/v1/packs/folded', { title: 'x' }, owner)).status).toBe(403)
  })

  it('rejects unsafe or incomplete manifests and duplicate versions', async () => {
    const e = env()
    const token = signIn(e, 'owner')
    await publishPack(e, token)
    const publish = (m: unknown, version = '9') => call(e, 'POST', '/v1/packs/folded/versions', { version, manifest: m }, token)
    const file = (extra: Record<string, unknown>) => manifest([{ path: 'mods/a.jar', hashes: { sha1: sha1('a') }, ...extra }])
    for (const path of ['../evil.jar', '/abs.jar', 'mods/../../x', 'C:/x.jar', 'mods\\a.jar', 'instance.json', '.install-profile/x']) {
      const r = await publish(manifest([{ path, hashes: { sha1: sha1('a') }, downloads: ['https://x.example/a'] }]))
      expect(r.status, path).toBe(400)
    }
    expect((await publish(file({}))).status).toBe(400)
    expect((await publish(file({ downloads: ['http://insecure.example/a.jar'] }))).status).toBe(400)
    expect((await publish(file({ curseforge: { projectId: '1', fileId: 2 } }))).status).toBe(400)
    expect((await publish(manifest([{ path: 'mods/a.jar', hashes: {}, modrinth: { projectId: 'p', versionId: 'v' } }]))).status).toBe(400)
    expect((await publish({ files: [] })).status).toBe(400)
    const dup = { path: 'mods/A.jar', hashes: { sha1: sha1('a') }, modrinth: { projectId: 'p', versionId: 'v' } }
    expect((await publish(manifest([dup, { ...dup, path: 'mods/a.jar' }]))).status).toBe(400)
    const body = await (await publish(file({}))).json() as any
    expect(body).toMatchObject({ error: 'invalid_manifest', detail: 'files: mods/a.jar has no valid source' })
    expect((await publish(manifest(), '1.0.0')).status).toBe(409)
    expect((await publish(manifest(), 'bad version')).status).toBe(400)
  })

  it('deletes a version', async () => {
    const e = env()
    const token = signIn(e, 'owner')
    const version = await publishPack(e, token)
    expect((await call(e, 'DELETE', `/v1/packs/folded/versions/${version.id}`, undefined, token)).status).toBe(204)
    expect((await call(e, 'GET', `/v1/packs/folded/versions/${version.id}`)).status).toBe(404)
    expect((await call(e, 'DELETE', `/v1/packs/folded/versions/${version.id}`, undefined, token)).status).toBe(404)
  })

  it('reserves the file route and reports missing storage', async () => {
    const e = env()
    const token = signIn(e, 'owner')
    expect((await call(e, 'PUT', '/v1/packs/files', { title: 'x' }, token)).status).toBe(404)
    expect((await call({}, 'GET', '/v1/packs')).status).toBe(503)
    expect((await call(e, 'GET', `/v1/packs/files/${sha1('a')}`)).status).toBe(503)
    expect((await call(e, 'GET', '/v1/packs/files/not-a-hash')).status).toBe(404)
  })
})

describe('pack files', () => {
  afterEach(() => vi.unstubAllGlobals())
  const storage = {
    S3_ENDPOINT: 'https://s3.example.com', S3_BUCKET: 'rel',
    S3_READ_ACCESS_KEY_ID: 'read', S3_READ_SECRET_ACCESS_KEY: 'rs',
    S3_PACKS_ACCESS_KEY_ID: 'packs', S3_PACKS_SECRET_ACCESS_KEY: 'ps',
  }

  it('stores an upload under its sha1 with the packs key and serves it back', async () => {
    const e = env(storage)
    const token = signIn(e, 'owner')
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('stored'))
    vi.stubGlobal('fetch', fetchMock)
    const bytes = new TextEncoder().encode('config=true')
    const hash = sha1('config=true')

    const uploaded = await call(e, 'PUT', `/v1/packs/files/${hash}`, bytes, token)
    expect(uploaded.status).toBe(201)
    expect(await uploaded.json()).toMatchObject({ sha1: hash, size: bytes.length, url: `https://api.example.com/v1/packs/files/${hash}` })
    const put = new URL(fetchMock.mock.calls[0][0])
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PUT')
    expect(put.pathname).toBe(`/rel/packs/files/${hash}`)
    expect(put.searchParams.get('X-Amz-Credential')).toMatch(/^packs\//)

    const served = await call(e, 'GET', `/v1/packs/files/${hash}`)
    expect(served.status).toBe(200)
    expect(served.headers.get('cache-control')).toContain('immutable')
    const get = new URL(fetchMock.mock.calls[1][0])
    expect(get.pathname).toBe(`/rel/packs/files/${hash}`)
    expect(get.searchParams.get('X-Amz-Credential')).toMatch(/^read\//)
  })

  it('rejects a body that does not match its name, strangers, and missing write keys', async () => {
    const e = env(storage)
    const token = signIn(e, 'owner')
    const stranger = signIn(e, 'stranger')
    const fetchMock = vi.fn(async () => new Response('stored'))
    vi.stubGlobal('fetch', fetchMock)
    const bytes = new TextEncoder().encode('x')
    expect((await call(e, 'PUT', `/v1/packs/files/${sha1('y')}`, bytes, token)).status).toBe(400)
    expect((await call(e, 'PUT', `/v1/packs/files/${sha1('x')}`, bytes, stranger)).status).toBe(403)
    expect((await call({ ...e, S3_PACKS_ACCESS_KEY_ID: undefined }, 'PUT', `/v1/packs/files/${sha1('x')}`, bytes, token)).status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a storage failure on upload', async () => {
    const e = env(storage)
    const token = signIn(e, 'owner')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 403 })))
    expect((await call(e, 'PUT', `/v1/packs/files/${sha1('x')}`, new TextEncoder().encode('x'), token)).status).toBe(503)
  })
})
