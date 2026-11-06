import type { DownloadController, DownloadSample } from '@xmcl/file-transfer'

const GITHUB_ORIGIN = 'https://github.com'
const DATABASE_FETCH_TIMEOUT = 8_000
const SLOW_DOWNLOAD_THRESHOLD = 128 * 1024

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Vardrynn does not host the mod metadata or project mapping databases yet. The
 * upstream sources (Voxelum GitHub releases and the XMCL proxy) are denied by the
 * network policy, so no source is configured and nothing is requested. Adding a
 * Vardrynn-owned mirror here re-enables both features.
 */
export function getModMetadataDownloadUrls(_asset: 'db.sqlite' | 'db.sqlite.sha1'): string[] {
  return []
}

export function getProjectMappingDownloadUrls(_asset: string): string[] {
  return []
}

function createAttemptSignal(signal: AbortSignal | null | undefined) {
  const timeout = AbortSignal.timeout(DATABASE_FETCH_TIMEOUT)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

function responseError(url: string, response: Response) {
  return Object.assign(new Error(`Database download request failed with HTTP ${response.status}`), {
    url,
    statusCode: response.status,
  })
}

export async function fetchDatabaseText(fetcher: Fetcher, urls: string[], init: RequestInit = {}) {
  const errors: unknown[] = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    try {
      const response = await fetcher(url, {
        ...init,
        signal: i < urls.length - 1 ? createAttemptSignal(init.signal) : init.signal,
      })
      if (response.ok) {
        return (await response.text()).trim()
      }
      await response.body?.cancel().catch(() => {})
      errors.push(responseError(url, response))
    } catch (e) {
      init.signal?.throwIfAborted()
      errors.push(e)
    }
  }
  throw new AggregateError(errors, urls.length === 0 ? 'No database metadata source is configured' : 'All database metadata sources failed')
}

export async function databaseAssetExists(fetcher: Fetcher, urls: string[]) {
  const errors: unknown[] = []
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    try {
      const response = await fetcher(url, {
        method: 'HEAD',
        signal: i < urls.length - 1 ? createAttemptSignal(undefined) : undefined,
      })
      await response.body?.cancel().catch(() => {})
      if (response.ok) return true
      if (response.status === 404) return false
      errors.push(responseError(url, response))
    } catch (e) {
      errors.push(e)
    }
  }
  throw new AggregateError(errors, 'All database metadata sources failed')
}

export function createDatabaseDownloadController(): DownloadController {
  return {
    sampleInterval: 1_000,
    warmup: 5_000,
    maxResumes: 0,
    maxSlowRerolls: 0,
    maxNoProgressRerolls: 0,
    ttfbDeadline: 8_000,
    stallTimeout: 10_000,
    rangeSplitThreshold: 0,
    isAbortable: (origin) => origin === GITHUB_ORIGIN,
    onSample: (sample: DownloadSample) =>
      sample.origin === GITHUB_ORIGIN &&
      sample.elapsed >= 5_000 &&
      sample.speed < SLOW_DOWNLOAD_THRESHOLD
        ? 'abort'
        : 'continue',
  }
}
