import { ensureDir, readJson, writeJson } from 'fs-extra'
import { dirname } from 'path'
import { z } from 'zod'
import { LauncherApp } from '~/app'
import { Logger } from '~/infra'

export interface VersionMetadataSource<T> {
  url: string
  parse: (response: Response) => Promise<T>
}

interface CacheEntry<T> {
  source: string
  etag?: string
  lastModified?: string
  data: T
}

const cacheEntrySchema = z.object({
  source: z.string(),
  etag: z.string().optional(),
  lastModified: z.string().optional(),
  data: z.unknown(),
})

async function readCache<T>(cachePath: string, schema: z.ZodType<T>): Promise<CacheEntry<T> | undefined> {
  const raw = await readJson(cachePath).catch(() => undefined)
  if (!raw) return undefined
  const envelope = cacheEntrySchema.safeParse(raw)
  if (!envelope.success) return undefined
  const data = schema.safeParse(envelope.data.data)
  if (!data.success) return undefined
  return {
    source: envelope.data.source,
    etag: envelope.data.etag,
    lastModified: envelope.data.lastModified,
    data: data.data,
  }
}

async function writeCache<T>(cachePath: string, entry: CacheEntry<T>) {
  await ensureDir(dirname(cachePath))
  await writeJson(cachePath, entry)
}

type FetchResult<T> =
  | { status: 'fresh'; entry: CacheEntry<T> }
  | { status: 'notModified' }
  | { status: 'failed'; reason: unknown }

async function tryFetch<T>(
  app: LauncherApp,
  source: VersionMetadataSource<T>,
  schema: z.ZodType<T>,
  conditionalHeaders?: Record<string, string>,
): Promise<FetchResult<T>> {
  try {
    const response = await app.fetch(source.url, {
      headers: conditionalHeaders ?? {},
    })
    if (response.status === 304) {
      return { status: 'notModified' }
    }
    if (!response.ok) {
      return { status: 'failed', reason: new Error(`HTTP ${response.status} from ${source.url}`) }
    }
    const data = await source.parse(response)
    const parsed = schema.safeParse(data)
    if (!parsed.success) {
      return { status: 'failed', reason: parsed.error }
    }
    return {
      status: 'fresh',
      entry: {
        source: source.url,
        etag: response.headers.get('etag') ?? undefined,
        lastModified: response.headers.get('last-modified') ?? undefined,
        data: parsed.data,
      },
    }
  } catch (e) {
    return { status: 'failed', reason: e }
  }
}

async function raceSources<T>(
  app: LauncherApp,
  sources: VersionMetadataSource<T>[],
  schema: z.ZodType<T>,
): Promise<{ entry?: CacheEntry<T>; failures: unknown[] }> {
  const failures: unknown[] = []
  const entry = await new Promise<CacheEntry<T> | undefined>((resolve) => {
    let pending = sources.length
    if (pending === 0) {
      resolve(undefined)
      return
    }
    sources.forEach((source) => {
      tryFetch(app, source, schema).then((r) => {
        if (r.status === 'fresh') {
          resolve(r.entry)
          return
        }
        if (r.status === 'failed') failures.push(r.reason)
        pending -= 1
        if (pending === 0) resolve(undefined)
      })
    })
  })
  return { entry, failures }
}

/**
 * In-flight background revalidations, keyed by cachePath. Used to dedupe
 * concurrent SWR calls so we don't fire a network storm when several
 * consumers ask for the same metadata in the same tick.
 */
const inflightRevalidations = new Map<string, Promise<void>>()

export interface FetchVersionMetadataOptions<T> {
  app: LauncherApp
  cachePath: string
  schema: z.ZodType<T>
  sources: VersionMetadataSource<T>[]
  logger?: Logger
  /**
   * Bypass the SWR fast path: always wait for the network before returning,
   * and overwrite the cache with whatever the network gives back. Used for
   * explicit refresh actions.
   */
  force?: boolean
  /**
   * Called whenever fresh data is fetched from the network and written to
   * the cache. Fires on:
   *
   * - cold-cache initial fetch (so subscribers that weren't the original
   *   caller also see the data),
   * - background revalidation that returns 200,
   * - `force: true` refresh that returns 200.
   *
   * Does **not** fire on 304, on failure, or when the cache is read without
   * touching the network. The original caller of `fetchVersionMetadata`
   * receives the same data via the returned promise — handling both is
   * idempotent.
   */
  onFresh?: (data: T) => void
}

/**
 * Fetch version metadata with on-disk JSON caching, etag/if-modified-since
 * revalidation and bmclapi-style mirror fallback.
 *
 * Default mode is **stale-while-revalidate**:
 *
 * - Cache hit → return immediately with the cached data, and schedule a
 *   background revalidation. If revalidation comes back with fresh data,
 *   `onFresh` is invoked so the caller can broadcast the update. If it
 *   comes back 304 or fails, the cache and caller's data stay as-is.
 * - Cache miss → block on a race across every source and write the winner.
 * - `force: true` → ignore SWR, block, and overwrite the cache.
 *
 * A malformed remote response (zod rejection, non-2xx, thrown error) never
 * overwrites a healthy cache.
 */
export async function fetchVersionMetadata<T>({
  app,
  cachePath,
  schema,
  sources,
  logger,
  force,
  onFresh,
}: FetchVersionMetadataOptions<T>): Promise<T> {
  const cached = await readCache(cachePath, schema)

  if (force) {
    return blockingRefresh({ app, cachePath, schema, sources, logger, cached, onFresh })
  }

  if (cached) {
    scheduleRevalidation({ app, cachePath, schema, sources, logger, cached, onFresh })
    return cached.data
  }

  return blockingRefresh({ app, cachePath, schema, sources, logger, cached, onFresh })
}

async function blockingRefresh<T>(opts: {
  app: LauncherApp
  cachePath: string
  schema: z.ZodType<T>
  sources: VersionMetadataSource<T>[]
  logger?: Logger
  cached?: CacheEntry<T>
  onFresh?: (data: T) => void
}): Promise<T> {
  const { app, cachePath, schema, sources, logger, cached, onFresh } = opts
  // Force / cold-cache path: try the preferred (previously cached) source
  // first with conditional headers if we have any, otherwise race all.
  if (cached) {
    const preferred = sources.find(s => s.url === cached.source)
    if (preferred) {
      const headers: Record<string, string> = {}
      if (cached.etag) headers['If-None-Match'] = cached.etag
      if (cached.lastModified) headers['If-Modified-Since'] = cached.lastModified
      const r = await tryFetch(app, preferred, schema, headers)
      if (r.status === 'notModified') return cached.data
      if (r.status === 'fresh') {
        await writeCache(cachePath, r.entry).catch(e => logger?.warn(e))
        onFresh?.(r.entry.data)
        return r.entry.data
      }
      logger?.warn(`Conditional fetch failed for ${preferred.url}: ${String(r.reason)}`)
    }
  }

  const { entry, failures } = await raceSources(app, sources, schema)
  if (entry) {
    await writeCache(cachePath, entry).catch(e => logger?.warn(e))
    onFresh?.(entry.data)
    return entry.data
  }
  if (cached) {
    logger?.warn(`All version metadata sources failed for ${cachePath}, returning stale cache`)
    return cached.data
  }
  throw new AggregateError(
    failures.map(f => f instanceof Error ? f : new Error(String(f))),
    `Failed to fetch version metadata at ${cachePath}`,
  )
}

function scheduleRevalidation<T>(opts: {
  app: LauncherApp
  cachePath: string
  schema: z.ZodType<T>
  sources: VersionMetadataSource<T>[]
  logger?: Logger
  cached: CacheEntry<T>
  onFresh?: (data: T) => void
}) {
  const { cachePath } = opts
  if (inflightRevalidations.has(cachePath)) return
  const task = revalidate(opts).finally(() => {
    inflightRevalidations.delete(cachePath)
  })
  inflightRevalidations.set(cachePath, task)
}

async function revalidate<T>(opts: {
  app: LauncherApp
  cachePath: string
  schema: z.ZodType<T>
  sources: VersionMetadataSource<T>[]
  logger?: Logger
  cached: CacheEntry<T>
  onFresh?: (data: T) => void
}): Promise<void> {
  const { app, cachePath, schema, sources, logger, cached, onFresh } = opts

  // First try the previously-good source with conditional headers — the
  // happy path is a 304 with zero body.
  const preferred = sources.find(s => s.url === cached.source)
  if (preferred) {
    const headers: Record<string, string> = {}
    if (cached.etag) headers['If-None-Match'] = cached.etag
    if (cached.lastModified) headers['If-Modified-Since'] = cached.lastModified
    const r = await tryFetch(app, preferred, schema, headers)
    if (r.status === 'notModified') return
    if (r.status === 'fresh') {
      await writeCache(cachePath, r.entry).catch(e => logger?.warn(e))
      onFresh?.(r.entry.data)
      return
    }
    logger?.warn(`Background revalidation failed for ${preferred.url}: ${String(r.reason)}`)
  }

  // Cached source is gone or broken — try every other source unconditionally.
  // A failure here is not surfaced to the caller; the stale cache they
  // already received stays valid and we'll try again next call.
  const fallbackSources = preferred ? sources.filter(s => s.url !== preferred.url) : sources
  if (fallbackSources.length === 0) return
  const { entry } = await raceSources(app, fallbackSources, schema)
  if (entry) {
    await writeCache(cachePath, entry).catch(e => logger?.warn(e))
    onFresh?.(entry.data)
  }
}

/**
 * Test-only helper: wait for any in-flight background revalidation for the
 * given cachePath to settle. Returns immediately if there is nothing pending.
 */
export function flushRevalidation(cachePath: string): Promise<void> {
  return inflightRevalidations.get(cachePath) ?? Promise.resolve()
}
