import { afterEach, describe, expect, it, vi } from 'vitest'
import worker from './worker.js'

const env = { CURSEFORGE_API_KEY: 'test-key' }
const call = (path: string, init?: RequestInit, e: any = env) =>
  worker.fetch(new Request(`https://api.example.com${path}`, init), e)

describe('CurseForge proxy', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('adds the key and forwards the path and query', async () => {
    const upstream = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response('{"data":[]}', { headers: { 'content-type': 'application/json', 'set-cookie': 'x=1' } }))
    vi.stubGlobal('fetch', upstream)
    const response = await call('/v1/curseforge/v1/mods/search?gameId=432&searchFilter=jei', {
      headers: { accept: 'application/json', authorization: 'Bearer user', 'x-api-key': 'client' },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"data":[]}')
    expect(response.headers.get('set-cookie')).toBeNull()
    const [url, init] = upstream.mock.calls[0]
    expect(url).toBe('https://api.curseforge.com/v1/mods/search?gameId=432&searchFilter=jei')
    const headers = init.headers as Headers
    expect(headers.get('x-api-key')).toBe('test-key')
    expect(headers.get('authorization')).toBeNull()
    expect(headers.get('accept')).toBe('application/json')
    expect(init.redirect).toBe('manual')
  })

  it('forwards POST bodies', async () => {
    const upstream = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}'))
    vi.stubGlobal('fetch', upstream)
    const body = JSON.stringify({ fingerprints: [1, 2] })
    const response = await call('/v1/curseforge/v1/fingerprints/432', {
      method: 'POST', body, headers: { 'content-type': 'application/json' },
    })
    expect(response.status).toBe(200)
    expect(new TextDecoder().decode(upstream.mock.calls[0][1].body as ArrayBuffer)).toBe(body)
  })

  it('reaches only the CurseForge API paths', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    for (const path of ['/v1/curseforge/', '/v1/curseforge/v3/mods', '/v1/curseforge/v1/../admin', '/v1/curseforge/other']) {
      expect((await call(path)).status).toBe(404)
    }
    expect((await call('/v1/curseforge/v1/mods/1', { method: 'DELETE' })).status).toBe(405)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('refuses without a key, over the rate limit, or with a large body', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    expect((await call('/v1/curseforge/v1/categories', undefined, {})).status).toBe(503)
    const limited = { ...env, CURSEFORGE_RATE_LIMITER: { limit: async () => ({ success: false }) } }
    expect((await call('/v1/curseforge/v1/categories', undefined, limited)).status).toBe(429)
    const big = 'x'.repeat(1024 * 1024 + 1)
    expect((await call('/v1/curseforge/v1/mods', { method: 'POST', body: big })).status).toBe(413)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('does not follow redirects or hide upstream errors', async () => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 302, headers: { location: 'https://evil.example.com/' } }))
    expect((await call('/v1/curseforge/v1/categories')).status).toBe(502)
    vi.stubGlobal('fetch', async () => new Response('{"error":"nope"}', { status: 403 }))
    expect((await call('/v1/curseforge/v1/categories')).status).toBe(403)
    vi.stubGlobal('fetch', async () => { throw new Error('down') })
    expect((await call('/v1/curseforge/v1/categories')).status).toBe(502)
  })
})
