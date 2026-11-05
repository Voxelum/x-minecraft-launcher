import { describe, expect, it } from 'vitest'
import { parseVardrynnRelease, parseVardrynnReleaseKey, selectVerifiedAsset } from '~/app/vardrynnRelease'
import { buildReleaseManifest, generateReleaseKeyPair } from '../scripts/vardrynnRelease'
import { afterEach, vi } from 'vitest'
import worker, { presign } from './worker.js'

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

describe('S3 storage', () => {
  afterEach(() => vi.unstubAllGlobals())
  const env = {
    S3_ENDPOINT: 'https://s3.example.com', S3_BUCKET: 'rel', S3_REGION: 'us-east-1',
    S3_READ_ACCESS_KEY_ID: 'AKIDEXAMPLE', S3_READ_SECRET_ACCESS_KEY: 'secret',
  }

  it('matches the AWS presigned URL example', async () => {
    const url = await presign(
      { S3_READ_ACCESS_KEY_ID: 'AKIAIOSFODNN7EXAMPLE', S3_READ_SECRET_ACCESS_KEY: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY' },
      new URL('https://examplebucket.s3.amazonaws.com/test.txt'), 86400, new Date('2013-05-24T00:00:00Z'))
    expect(url).toContain('X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404')
  })

  it("reads the manifest with a signed request and presigns this bucket's asset URLs", async () => {
    const manifest = {
      apiVersion: 'v1',
      assets: [
        { url: 'https://s3.example.com/rel/1.0.0/a b.dmg', sha256: 'x' },
        { url: 'https://other.example.com/rel/1.0.0/b.deb', sha256: 'y' },
      ],
    }
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify(manifest)))
    vi.stubGlobal('fetch', fetchMock)
    const response = await get('/v1/releases/latest', env)
    expect(response.status).toBe(200)
    const requested = new URL(fetchMock.mock.calls[0][0])
    expect(requested.pathname).toBe('/rel/latest.json')
    expect(requested.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    const body: any = await response.json()
    const signed = new URL(body.assets[0].url)
    expect(signed.pathname).toBe('/rel/1.0.0/a%20b.dmg')
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('3600')
    expect(body.assets[1].url).toBe('https://other.example.com/rel/1.0.0/b.deb')
    expect(JSON.stringify(body)).not.toContain('secret')
  })

  it('maps storage 404 to no release and other failures to unavailable', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }))
    expect((await get('/v1/releases/latest', env)).status).toBe(404)
    vi.stubGlobal('fetch', async () => new Response('', { status: 403 }))
    expect((await get('/v1/releases/latest', env)).status).toBe(503)
  })
})
