import { describe, expect, it } from 'vitest'
import { parseVardrynnRelease, parseVardrynnReleaseKey, selectVerifiedAsset } from '~/app/vardrynnRelease'
import { buildReleaseManifest, generateReleaseKeyPair } from '../scripts/vardrynnRelease'
import worker from './worker.js'

const get = (path: string, env?: unknown, method = 'GET') =>
  worker.fetch(new Request(`https://api.example.com${path}`, { method }), env as any)
const bucket = (body: string | null) => ({
  get: async (key: string) => key === 'latest.json' && body !== null
    ? { json: async () => JSON.parse(body) }
    : null,
})

describe('release route', () => {
  it('serves a signed manifest the launcher accepts', async () => {
    const keys = generateReleaseKeyPair()
    const manifest = buildReleaseManifest({
      version: '1.2.0', channel: 'stable', publishedAt: '2026-11-04T00:00:00Z', notesUrl: 'https://example.com/n',
      downloadBase: 'https://downloads.example.com/1.2.0', signingKey: keys.privateKey, publicKey: keys.publicKey,
      files: [{ name: 'vardrynn-1.2.0-arm64.dmg', bytes: Buffer.from('mac') }],
    })
    const response = await get('/v1/releases/latest', { RELEASES: bucket(JSON.stringify(manifest)) })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    const release = parseVardrynnRelease(await response.json())!
    expect(selectVerifiedAsset(release, 'darwin', 'arm64', parseVardrynnReleaseKey(keys.publicKey)!)).toBeDefined()
  })

  it('reports no release without a binding or an uploaded manifest', async () => {
    expect((await get('/v1/releases/latest')).status).toBe(404)
    expect((await get('/v1/releases/latest', { RELEASES: bucket(null) })).status).toBe(404)
  })

  it('fails as unavailable on a bad upload or storage error', async () => {
    expect((await get('/v1/releases/latest', { RELEASES: bucket('not json') })).status).toBe(503)
    expect((await get('/v1/releases/latest', { RELEASES: bucket('{"apiVersion":"v2"}') })).status).toBe(503)
    const failing = { get: async () => { throw new Error('r2 down') } }
    expect((await get('/v1/releases/latest', { RELEASES: failing })).status).toBe(503)
  })

  it('keeps the other routes unchanged', async () => {
    expect(await (await get('/v1/status')).json()).toEqual({ apiVersion: 'v1', state: 'ok' })
    expect((await get('/v1/config')).status).toBe(404)
    expect((await get('/v1/releases/latest', undefined, 'POST')).status).toBe(405)
  })
})
