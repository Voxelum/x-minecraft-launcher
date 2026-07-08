import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'
import type { VersionMetadataException } from '@xmcl/runtime-api'
import { fetchVersionMetadata, flushRevalidation, VersionMetadataSource } from './versionMetadataCache'

const payloadSchema = z.array(z.object({ version: z.string() }))
type Payload = z.infer<typeof payloadSchema>

function makeApp(fetchImpl: (url: string, init?: any) => Promise<Response>) {
  const dir = mkdtempSync(join(tmpdir(), 'xmcl-vmc-'))
  return {
    appDataPath: dir,
    fetch: vi.fn(fetchImpl),
    dispose: () => rmSync(dir, { recursive: true, force: true }),
  }
}

function jsonResponse(body: any, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...(init.headers as Record<string, string>) },
    ...init,
  })
}

function seedCache(cachePath: string, entry: Record<string, unknown>) {
  mkdirSync(dirname(cachePath), { recursive: true })
  writeFileSync(cachePath, JSON.stringify(entry))
}

const source = (url: string): VersionMetadataSource<Payload> => ({
  url,
  parse: (r) => r.json() as Promise<Payload>,
})

describe('fetchVersionMetadata (cold cache, blocking)', () => {
  let app: ReturnType<typeof makeApp>
  let cachePath: string

  beforeEach(() => {
    app = makeApp(async () => new Response('', { status: 500 }))
    cachePath = join(app.appDataPath, 'cache.json')
  })

  afterEach(() => { app.dispose() })

  test('fetches from the first source and writes the result to disk', async () => {
    const remote: Payload = [{ version: '1.0' }]
    cachePath = join(app.appDataPath, 'sub', 'cache.json')
    app.fetch.mockImplementation(async (url) => {
      expect(url).toBe('https://primary/data.json')
      return jsonResponse(remote, { headers: { etag: 'W/"abc"', 'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT' } })
    })

    const onFresh = vi.fn()
    const result = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
      onFresh,
    })

    expect(result).toEqual(remote)
    // Cold-cache success must also fire onFresh so subscribers that weren't
    // the original caller (e.g. a sibling composable mounted in parallel) get
    // notified the moment data lands.
    expect(onFresh).toHaveBeenCalledWith(remote)
    const onDisk = JSON.parse(readFileSync(cachePath, 'utf-8'))
    expect(onDisk).toEqual({
      source: 'https://primary/data.json',
      etag: 'W/"abc"',
      lastModified: 'Wed, 21 Oct 2026 07:28:00 GMT',
      data: remote,
    })
  })

  test('falls over to the mirror when the primary throws', async () => {
    const remote: Payload = [{ version: 'mirror' }]
    app.fetch.mockImplementation(async (url) => {
      if (url === 'https://primary/data.json') throw new Error('boom')
      return jsonResponse(remote)
    })

    const result = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
    })

    expect(result).toEqual(remote)
    expect(JSON.parse(readFileSync(cachePath, 'utf-8')).source).toBe('https://mirror/data.json')
  })

  test('throws VersionMetadataException when every source fails and there is no cache', async () => {
    app.fetch.mockImplementation(async () => { throw new Error('offline') })

    const onFresh = vi.fn()
    await expect(fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
      onFresh,
    })).rejects.toMatchObject({
      name: 'VersionMetadataException',
      exception: {
        type: 'versionMetadataFetchFailed',
        cachePath,
        sources: ['https://primary/data.json', 'https://mirror/data.json'],
      },
      cause: expect.any(AggregateError),
    } satisfies Partial<VersionMetadataException>)
    expect(onFresh).not.toHaveBeenCalled()
  })

  test('treats non-2xx as soft failure and falls back to mirror', async () => {
    const remote: Payload = [{ version: 'mirror' }]
    app.fetch.mockImplementation(async (url) => {
      if (url === 'https://primary/data.json') return new Response('', { status: 503 })
      return jsonResponse(remote)
    })

    const result = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
    })

    expect(result).toEqual(remote)
  })

  test('rejects payloads that fail zod validation and falls back to mirror', async () => {
    const valid: Payload = [{ version: '1.0' }]
    app.fetch.mockImplementation(async (url) => {
      if (url === 'https://primary/data.json') return jsonResponse([{ not: 'a version' }])
      return jsonResponse(valid)
    })

    const result = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
    })

    expect(result).toEqual(valid)
    expect(JSON.parse(readFileSync(cachePath, 'utf-8')).source).toBe('https://mirror/data.json')
  })

  test('ignores a corrupted on-disk cache and refetches', async () => {
    writeFileSync(cachePath, '{not json')

    const fresh: Payload = [{ version: 'fresh' }]
    app.fetch.mockImplementation(async () => jsonResponse(fresh))

    const result = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json')],
    })

    expect(result).toEqual(fresh)
  })
})

describe('fetchVersionMetadata (warm cache, stale-while-revalidate)', () => {
  let app: ReturnType<typeof makeApp>
  let cachePath: string

  beforeEach(() => {
    app = makeApp(async () => new Response('', { status: 500 }))
    cachePath = join(app.appDataPath, 'cache.json')
  })

  afterEach(() => { app.dispose() })

  test('returns the cached payload immediately without waiting for the network', async () => {
    const cached: Payload = [{ version: 'cached' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      etag: 'W/"abc"',
      data: cached,
    })

    let fetchStarted = false
    app.fetch.mockImplementation(async () => {
      fetchStarted = true
      // Block forever so we can prove the caller did not wait for us.
      await new Promise(() => {})
      return jsonResponse(cached)
    })

    const result = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json')],
    })

    expect(result).toEqual(cached)
    expect(fetchStarted).toBe(true)
  })

  test('fires onFresh and persists the new payload when revalidation returns 200', async () => {
    const cached: Payload = [{ version: 'old' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      etag: 'old-etag',
      data: cached,
    })

    const fresh: Payload = [{ version: 'new' }]
    app.fetch.mockImplementation(async () => jsonResponse(fresh, { headers: { etag: 'new-etag' } }))

    const onFresh = vi.fn()
    const immediate = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json')],
      onFresh,
    })

    expect(immediate).toEqual(cached)
    await flushRevalidation(cachePath)
    expect(onFresh).toHaveBeenCalledWith(fresh)

    const onDisk = JSON.parse(readFileSync(cachePath, 'utf-8'))
    expect(onDisk.etag).toBe('new-etag')
    expect(onDisk.data).toEqual(fresh)
  })

  test('does not fire onFresh on 304 and leaves the cache untouched', async () => {
    const cached: Payload = [{ version: 'cached' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      etag: 'W/"abc"',
      lastModified: 'Wed, 21 Oct 2026 07:28:00 GMT',
      data: cached,
    })
    const original = readFileSync(cachePath, 'utf-8')

    app.fetch.mockImplementation(async (_url, init) => {
      expect(init?.headers?.['If-None-Match']).toBe('W/"abc"')
      expect(init?.headers?.['If-Modified-Since']).toBe('Wed, 21 Oct 2026 07:28:00 GMT')
      return new Response(null, { status: 304 })
    })

    const onFresh = vi.fn()
    const immediate = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
      onFresh,
    })
    expect(immediate).toEqual(cached)

    await flushRevalidation(cachePath)
    expect(onFresh).not.toHaveBeenCalled()
    // Only the preferred source was contacted — no mirror race on 304.
    expect(app.fetch).toHaveBeenCalledTimes(1)
    expect(readFileSync(cachePath, 'utf-8')).toBe(original)
  })

  test('does not fire onFresh and preserves cache when every source throws', async () => {
    const cached: Payload = [{ version: 'healthy' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      data: cached,
    })
    const original = readFileSync(cachePath, 'utf-8')

    app.fetch.mockImplementation(async () => { throw new Error('network down') })

    const onFresh = vi.fn()
    const immediate = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
      onFresh,
    })
    expect(immediate).toEqual(cached)

    await flushRevalidation(cachePath)
    expect(onFresh).not.toHaveBeenCalled()
    // A broken network must never poison a healthy cache.
    expect(readFileSync(cachePath, 'utf-8')).toBe(original)
  })

  test('does not fire onFresh and preserves cache when every source returns malformed data', async () => {
    const cached: Payload = [{ version: 'healthy' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      etag: 'W/"abc"',
      data: cached,
    })
    const original = readFileSync(cachePath, 'utf-8')

    app.fetch.mockImplementation(async (_url, init) => {
      if (init?.headers?.['If-None-Match']) return jsonResponse([{ junk: true }])
      return jsonResponse([{ also: 'junk' }])
    })

    const onFresh = vi.fn()
    const immediate = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
      onFresh,
    })
    expect(immediate).toEqual(cached)

    await flushRevalidation(cachePath)
    expect(onFresh).not.toHaveBeenCalled()
    expect(readFileSync(cachePath, 'utf-8')).toBe(original)
  })

  test('falls over to the mirror in the background when the cached source is now broken', async () => {
    const cached: Payload = [{ version: 'cached' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      etag: 'W/"abc"',
      data: cached,
    })

    const mirror: Payload = [{ version: 'fresh-mirror' }]
    app.fetch.mockImplementation(async (url, init) => {
      if (url === 'https://primary/data.json' && init?.headers?.['If-None-Match']) {
        return jsonResponse([{ broken: true }])
      }
      if (url === 'https://mirror/data.json') return jsonResponse(mirror)
      return jsonResponse([{ also: 'broken' }])
    })

    const onFresh = vi.fn()
    const immediate = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
      onFresh,
    })
    expect(immediate).toEqual(cached)

    await flushRevalidation(cachePath)
    expect(onFresh).toHaveBeenCalledWith(mirror)
    const onDisk = JSON.parse(readFileSync(cachePath, 'utf-8'))
    expect(onDisk.source).toBe('https://mirror/data.json')
    expect(onDisk.data).toEqual(mirror)
  })

  test('falls over to the only remaining source when the cached source was rotated out', async () => {
    const cached: Payload = [{ version: 'cached' }]
    seedCache(cachePath, {
      source: 'https://removed/data.json',
      etag: 'W/"abc"',
      data: cached,
    })

    const fresh: Payload = [{ version: 'mirror' }]
    app.fetch.mockImplementation(async (url, init) => {
      expect(url).toBe('https://mirror/data.json')
      expect(init?.headers?.['If-None-Match']).toBeUndefined()
      return jsonResponse(fresh)
    })

    const onFresh = vi.fn()
    const immediate = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://mirror/data.json')],
      onFresh,
    })
    expect(immediate).toEqual(cached)

    await flushRevalidation(cachePath)
    expect(onFresh).toHaveBeenCalledWith(fresh)
    expect(JSON.parse(readFileSync(cachePath, 'utf-8')).data).toEqual(fresh)
  })

  test('dedupes concurrent revalidations for the same cache path', async () => {
    const cached: Payload = [{ version: 'cached' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      etag: 'W/"abc"',
      data: cached,
    })

    let resolveFetch!: (r: Response) => void
    app.fetch.mockImplementation(() => new Promise<Response>((res) => { resolveFetch = res }))

    const onFreshA = vi.fn()
    const onFreshB = vi.fn()
    const [a, b] = await Promise.all([
      fetchVersionMetadata({ app: app as any, cachePath, schema: payloadSchema, sources: [source('https://primary/data.json')], onFresh: onFreshA }),
      fetchVersionMetadata({ app: app as any, cachePath, schema: payloadSchema, sources: [source('https://primary/data.json')], onFresh: onFreshB }),
    ])
    expect(a).toEqual(cached)
    expect(b).toEqual(cached)
    // Only one in-flight network call despite two concurrent callers.
    expect(app.fetch).toHaveBeenCalledTimes(1)

    const fresh: Payload = [{ version: 'fresh' }]
    resolveFetch(jsonResponse(fresh))
    await flushRevalidation(cachePath)

    // The dedupe is by design: both callers already returned data, and the
    // service layer broadcasts a single event to all subscribers. Exactly
    // one onFresh fires per revalidation cycle (whichever caller's
    // scheduleRevalidation won the race to set the in-flight flag).
    const calls = [...onFreshA.mock.calls, ...onFreshB.mock.calls]
    expect(calls).toEqual([[fresh]])
  })
})

describe('fetchVersionMetadata (force refresh)', () => {
  let app: ReturnType<typeof makeApp>
  let cachePath: string

  beforeEach(() => {
    app = makeApp(async () => new Response('', { status: 500 }))
    cachePath = join(app.appDataPath, 'cache.json')
  })

  afterEach(() => { app.dispose() })

  test('blocks and overwrites the cache when force=true and the server has new data', async () => {
    const cached: Payload = [{ version: 'cached' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      etag: 'old-etag',
      data: cached,
    })

    const fresh: Payload = [{ version: 'fresh' }]
    app.fetch.mockImplementation(async (_url, init) => {
      // Force still uses conditional headers; it just makes the caller wait.
      expect(init?.headers?.['If-None-Match']).toBe('old-etag')
      return jsonResponse(fresh, { headers: { etag: 'new-etag' } })
    })

    const onFresh = vi.fn()
    const result = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json')],
      force: true,
      onFresh,
    })

    expect(result).toEqual(fresh)
    expect(onFresh).toHaveBeenCalledWith(fresh)
    expect(JSON.parse(readFileSync(cachePath, 'utf-8')).etag).toBe('new-etag')
  })

  test('returns the stale cache without overwriting when force=true and every source fails', async () => {
    const cached: Payload = [{ version: 'stale' }]
    seedCache(cachePath, {
      source: 'https://primary/data.json',
      data: cached,
    })
    const original = readFileSync(cachePath, 'utf-8')

    app.fetch.mockImplementation(async () => { throw new Error('offline') })

    const result = await fetchVersionMetadata({
      app: app as any,
      cachePath,
      schema: payloadSchema,
      sources: [source('https://primary/data.json'), source('https://mirror/data.json')],
      force: true,
    })

    expect(result).toEqual(cached)
    expect(readFileSync(cachePath, 'utf-8')).toBe(original)
  })
})
