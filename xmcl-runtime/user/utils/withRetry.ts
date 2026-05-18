/**
 * Compose a retrying `fetch` on top of any underlying `fetch` implementation.
 *
 * The launcher's `app.fetch` resolves to Electron's `net.fetch` (with an
 * undici fallback on network errors). Neither path applies undici's
 * `interceptors.retry`, so we wrap the fetch on the caller side to add
 * retry semantics for transient HTTP statuses (408 / 425 / 429 / 5xx),
 * honoring the `Retry-After` header. See issue #1445.
 *
 * Kept in the launcher (not in `@xmcl/user`) on purpose: the auth library
 * stays a pure protocol implementation with a single fetch injection
 * point, and the consumer decides on retry policy / dispatcher.
 */
export interface WithRetryOptions {
  /** HTTP statuses to retry. Default: [408, 425, 429, 500, 502, 503, 504]. */
  statusCodes?: number[]
  /** Max attempts including the first. Default: 4. */
  maxAttempts?: number
  /** Cap for the exponential backoff (ms). Default: 30_000. */
  maxBackoffMs?: number
  /** Base delay for the exponential backoff (ms). Default: 500. */
  baseBackoffMs?: number
}

const DEFAULT_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504]

/**
 * Wrap a `fetch` so it retries transient failures.
 *
 * - Honors `Retry-After` (seconds or HTTP-date) for the wait duration,
 *   never sleeping less than the exponential-backoff baseline.
 * - Aborts cleanly when the caller-supplied `AbortSignal` fires during a
 *   backoff sleep.
 * - Re-reads the response body only on the final attempt -- intermediate
 *   responses are discarded with `cancel()` to free the socket.
 */
export function withRetry(underlying: typeof fetch, options: WithRetryOptions = {}): typeof fetch {
  const statusCodes = new Set(options.statusCodes ?? DEFAULT_STATUS_CODES)
  const maxAttempts = options.maxAttempts ?? 4
  const maxBackoffMs = options.maxBackoffMs ?? 30_000
  const baseBackoffMs = options.baseBackoffMs ?? 500

  return (async (input: any, init?: any) => {
    const signal: AbortSignal | undefined = init?.signal
    let lastResponse: Response | undefined
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await underlying(input, init)
      if (!statusCodes.has(response.status) || attempt === maxAttempts - 1) {
        return response
      }
      lastResponse = response

      // Compute wait: exponential backoff, overridden by Retry-After when larger.
      let waitMs = Math.min(maxBackoffMs, baseBackoffMs * Math.pow(2, attempt))
      const retryAfter = response.headers.get('retry-after')
      if (retryAfter) {
        const asInt = parseInt(retryAfter, 10)
        if (!Number.isNaN(asInt)) {
          waitMs = Math.max(waitMs, asInt * 1000)
        } else {
          const dateMs = Date.parse(retryAfter)
          if (!Number.isNaN(dateMs)) {
            waitMs = Math.max(waitMs, dateMs - Date.now())
          }
        }
      }

      // Free the socket before sleeping; we'll issue a fresh request.
      try { await response.body?.cancel() } catch { /* ignore */ }

      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, Math.max(0, waitMs))
        const onAbort = () => {
          clearTimeout(t)
          reject(signal?.reason ?? new Error('Aborted'))
        }
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    }
    // Should be unreachable: the loop returns on its last iteration.
    return lastResponse as Response
  }) as typeof fetch
}
