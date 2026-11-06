import type { DownloadController } from '@xmcl/file-transfer'

const DATABASE_FETCH_TIMEOUT = 8_000

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

/**
 * The databases come from the Vardrynn service (`/v1/databases/...`), which serves the copies
 * kept by the mirror-databases workflow. A build without a service origin requests nothing.
 */
function getDatabaseDownloadUrls(origin: string | undefined, database: string, asset: string) {
  return origin ? [new URL(`/v1/databases/${database}/${encodeURIComponent(asset)}`, origin).toString()] : []
}

export function getModMetadataDownloadUrls(origin: string | undefined, asset: 'db.sqlite' | 'db.sqlite.sha1') {
  return getDatabaseDownloadUrls(origin, 'mod-metadata', asset)
}

export function getProjectMappingDownloadUrls(origin: string | undefined, asset: string) {
  return getDatabaseDownloadUrls(origin, 'project-mapping', asset)
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
  // One source, so a slow connection is left to finish rather than aborted.
  return {
    sampleInterval: 1_000,
    warmup: 5_000,
    maxResumes: 0,
    maxSlowRerolls: 0,
    maxNoProgressRerolls: 0,
    ttfbDeadline: 8_000,
    stallTimeout: 10_000,
    rangeSplitThreshold: 0,
    isAbortable: () => false,
  }
}
