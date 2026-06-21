import { close as sclose, ftruncate as sftruncate, mkdir as smkdir, open as sopen, unlink } from 'fs'
import { dirname } from 'path'
import { Dispatcher } from 'undici'
import { promisify } from 'util'
import { getDefaultAgent } from './agent'
import { ControlledFileHandler } from './controlled_handler'
import {
  DownloadController,
  isManagedAbortError,
  isRangeNotSupportedError,
  ManagedAbortError,
} from './controller'
import { ProgressTrackerMultiple, ProgressTrackerSingle } from './progress'
import { RangeRequestHandler } from './range_handler'
import { RangePolicy, resolveRangePolicy } from './range_policy'
import { decorateError } from './error'

export interface DownloadBaseOptions {
  rangePolicy?: RangePolicy
  dispatcher?: Dispatcher
  /**
   * Optional adaptive strategy. When supplied, the download runs as a
   * single resumable stream whose throughput is sampled, and the
   * controller may request a managed abort that resumes (via HTTP
   * `Range`) on a fresh connection instead of failing. When omitted,
   * the classic parallel-range / multi-URL-fallback path is used and
   * behaviour is unchanged.
   */
  controller?: DownloadController
}

export function getDownloadBaseOptions(options?: DownloadBaseOptions) {
  return {
    dispatcher: options?.dispatcher || getDefaultAgent(),
    rangePolicy: resolveRangePolicy(options?.rangePolicy),
    controller: options?.controller,
  }
}

export interface DownloadOptions extends DownloadBaseOptions {
  /**
   * The url or urls (fallback) of the resource
   */
  url: string | string[]
  /**
   * The header of the request
   */
  headers?: Record<string, any>
  /**
   * Where the file will be downloaded to
   */
  destination: string
  /**
   * The progress controller. If you want to track download progress, you should use this.
   */
  tracker?: ProgressTrackerSingle
  /**
   * The user abort signal to abort the download
   */
  signal?: AbortSignal
  /**
   * The expected total size of the file.
   */
  expectedTotal?: number
}

export type DownloadMultipleOption = Pick<
  DownloadOptions,
  'url' | 'headers' | 'destination' | 'expectedTotal'
>

export interface DownloadMultipleOptions extends DownloadBaseOptions {
  options: DownloadMultipleOption[]

  tracker?: ProgressTrackerMultiple

  signal?: AbortSignal
}

export async function downloadMultiple(
  options: DownloadMultipleOptions,
): Promise<PromiseSettledResult<void>[]> {
  const tracker = options.tracker

  if (tracker) {
    let expectedTotal = 0
    for (const opt of options.options) {
      if (!opt.expectedTotal) {
        expectedTotal = 0
        break
      }
      expectedTotal += opt.expectedTotal
    }
    if (expectedTotal) {
      tracker.expectedTotal = expectedTotal
    }
  }

  return Promise.allSettled(
    options.options.map((opt) =>
      download({
        ...opt,
        tracker: tracker?.subSingle(),
        signal: options.signal,
        ...getDownloadBaseOptions(options),
      }),
    ),
  )
}

export async function download(options: DownloadOptions): Promise<void> {
  const urls = typeof options.url === 'string' ? [options.url] : options.url
  const headers = options.headers || {}
  const destination = options.destination
  const tracker = options.tracker
  const signal = options.signal
  const expectedTotal = options.expectedTotal
  const { dispatcher, rangePolicy, controller } = getDownloadBaseOptions(options)

  // Check if already aborted before opening file
  signal?.throwIfAborted()

  if (tracker && expectedTotal) {
    tracker.expectedTotal = expectedTotal
  }

  const fd = await openFd(options.destination)
  // Move the post-open abort check inside the try/finally so an abort
  // race here (signal fires between openFd resolving and this line)
  // still results in fd being closed.
  const errors = []

  try {
    signal?.throwIfAborted()

    if (controller) {
      await downloadWithController({
        urls,
        headers,
        fd,
        dispatcher,
        controller,
        tracker,
        signal,
        expectedTotal: expectedTotal ?? 0,
      })
      await close(fd).catch(() => {})
      return
    }

    for (const url of urls) {
      const parsedUrl = new URL(url)
      const ops = {
        path: parsedUrl.pathname + parsedUrl.search,
        origin: parsedUrl.origin,
        method: 'GET',
        signal,
        headers: {
          ...headers,
          ...(expectedTotal && expectedTotal > rangePolicy.rangeThreshold
            ? {
                Range: `bytes=0-${rangePolicy.rangeThreshold - 1}`,
              }
            : {}),
        },
      }
      // Allow one rewind+restart per URL: when the connection dies
      // mid-stream undici's retry interceptor sends a `Range:
      // bytes=<consumed>-` request to resume, and throws
      // `RequestRetryError` ("server does not support the range header
      // and the payload was partially consumed" / "content-range
      // mismatch") if the origin can't honour it (returns 200 or a
      // different range). Treat that as a transient failure and retry
      // this same URL from byte 0 with the file truncated, instead of
      // skipping to the (often equally broken) next mirror.
      let restartedForRangeRetry = false
      while (true) {
        const handler = new RangeRequestHandler(ops, dispatcher, fd, rangePolicy, tracker)
        dispatcher.dispatch(ops, handler)
        const err = await handler.wait().catch((e) => e)
        if (!err) {
          errors.length = 0
          // break out of both loops by setting urls.length = 0 below
          break
        }
        signal?.throwIfAborted()
        if (!restartedForRangeRetry && isRangeRetryError(err)) {
          restartedForRangeRetry = true
          await ftruncateAsync(fd, 0).catch(() => {})
          continue
        }
        errors.push(err)
        break
      }
      if (errors.length === 0) break
    }

    if (errors.length > 0) {
      if (errors.length === 1) {
        throw errors[0]
      }
      throw new AggregateError(errors, 'All urls failed to download')
    }

    await close(fd).catch(() => {})
  } catch (e) {
    decorateError(e as any, urls, headers, destination)
    await close(fd).catch(() => {})
    await unlinkAsync(destination).catch(() => {})
    throw e
  }
}

interface ControlledDownloadParams {
  urls: string[]
  headers: Record<string, any>
  fd: number
  dispatcher: Dispatcher
  controller: DownloadController
  tracker?: ProgressTrackerSingle
  signal?: AbortSignal
  expectedTotal: number
}

/**
 * The adaptive download path used when a {@link DownloadController} is
 * supplied. Runs a single resumable stream:
 *
 * - The controller samples throughput and may request a *managed abort*.
 *   On a managed abort we keep the partial bytes on disk and re-request
 *   the *same* URL — for a distributed CDN this re-triggers the redirect
 *   and (hopefully) lands on a faster mirror, resuming via `Range`.
 * - On a *terminal* failure (HTTP/network error after undici retries)
 *   we advance to the next fallback URL, still resuming from the bytes
 *   already written (safe because callers download content-addressed
 *   resources, so any mirror serves identical bytes).
 *
 * The partial file is never truncated here; the caller's outer
 * `catch` removes it only when every attempt is exhausted.
 */
async function downloadWithController(params: ControlledDownloadParams): Promise<void> {
  const { urls, headers, fd, dispatcher, controller, tracker, signal, expectedTotal } = params

  try {
    const splitThreshold = controller.rangeSplitThreshold ?? 4 * 1024 * 1024
    const concurrency = controller.rangeConcurrency ?? 4

    if (expectedTotal >= splitThreshold && concurrency > 1) {
      try {
        await downloadRanged(params, concurrency)
        return
      } catch (e) {
        if (!isRangeNotSupportedError(e)) throw e
        // A mirror ignored Range — abandon the split and re-download the
        // whole file as a single stream from a clean slate.
        await ftruncateAsync(fd, 0).catch(() => {})
      }
    }

    await runSegment({
      urls,
      headers,
      fd,
      dispatcher,
      controller,
      signal,
      expectedTotal,
      tracker,
    })
  } finally {
    if (tracker) {
      tracker.done = true
    }
  }
}

/**
 * Split a large file into `concurrency` byte-range segments and fetch
 * them in parallel. Because each segment is a *separate* request to the
 * (signed CDN) origin, each is independently redirected — so the chunks
 * stream from different mirrors at once. A slow mirror only delays its
 * own chunk, which the controller can re-roll. Rejects with
 * {@link RangeNotSupportedError} if any mirror refuses Range.
 */
async function downloadRanged(params: ControlledDownloadParams, concurrency: number): Promise<void> {
  const { urls, headers, fd, dispatcher, controller, tracker, signal, expectedTotal } = params

  const chunkSize = Math.ceil(expectedTotal / concurrency)
  const chunks: { start: number; end: number }[] = []
  for (let s = 0; s < expectedTotal; s += chunkSize) {
    chunks.push({ start: s, end: Math.min(expectedTotal - 1, s + chunkSize - 1) })
  }

  // Aggregate per-chunk progress into one shared accessor.
  const shared: ProgressTrackerSingle['accessor'] = {
    url: urls[0],
    total: expectedTotal,
    progress: 0,
  }
  if (tracker) tracker.setAccessor(shared)
  const segDone = new Array(chunks.length).fill(0)

  // Internal signal so one chunk's terminal failure cancels its siblings
  // (e.g. a RangeNotSupported chunk that forces a whole-file fallback).
  const ac = new AbortController()
  const onOuterAbort = () => ac.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) ac.abort(signal.reason)
    else signal.addEventListener('abort', onOuterAbort, { once: true })
  }

  try {
    await Promise.all(
      chunks.map((segment, i) =>
        runSegment({
          urls,
          headers,
          fd,
          dispatcher,
          controller,
          signal: ac.signal,
          expectedTotal,
          segment,
          onAdvance: (pos) => {
            segDone[i] = pos - segment.start
            shared.progress = segDone.reduce((a, b) => a + b, 0)
          },
        }),
      ),
    )
  } catch (e) {
    ac.abort(e)
    throw e
  } finally {
    signal?.removeEventListener('abort', onOuterAbort)
  }
}

interface SegmentParams {
  urls: string[]
  headers: Record<string, any>
  fd: number
  dispatcher: Dispatcher
  controller: DownloadController
  signal?: AbortSignal
  expectedTotal: number
  /**
   * Inclusive byte range this call is responsible for. Omitted for a
   * whole-file single stream.
   */
  segment?: { start: number; end: number }
  tracker?: ProgressTrackerSingle
  onAdvance?: (absolutePosition: number) => void
}

/**
 * Download one segment (or the whole file) over a single resumable,
 * speed-sampled connection. A managed abort re-requests the *same* URL
 * (re-roll → fresh mirror) resuming from where it stopped; a terminal
 * failure advances to the next fallback URL, still resuming. Throws
 * {@link RangeNotSupportedError} immediately if a ranged request is
 * answered with a full 200.
 */
async function runSegment(p: SegmentParams): Promise<void> {
  const { urls, headers, fd, dispatcher, controller, signal, expectedTotal } = p
  const maxResumes = controller.maxResumes ?? 5
  const maxNoProgress = controller.maxNoProgressRerolls ?? 2
  const isSeg = !!p.segment
  const segStart = p.segment?.start ?? 0
  const segEnd = p.segment?.end
  const segTotal = isSeg ? segEnd! - segStart + 1 : 0

  let resumeOffset = segStart
  let resumes = 0
  let noProgress = 0
  let committed = false
  let lastError: unknown
  let done = false

  for (let urlIndex = 0; urlIndex < urls.length; ) {
    const parsedUrl = new URL(urls[urlIndex])
    // Circuit breaker: when a re-assignable CDN is failing hard, skip its
    // URLs and fall straight through to a fallback — but never skip the
    // last remaining URL (it is the last resort).
    if (
      urlIndex < urls.length - 1 &&
      controller.shouldSkip?.(parsedUrl.origin)
    ) {
      urlIndex++
      continue
    }
    const range = isSeg
      ? `bytes=${resumeOffset}-${segEnd}`
      : resumeOffset > 0
        ? `bytes=${resumeOffset}-`
        : undefined
    const ops = {
      path: parsedUrl.pathname + parsedUrl.search,
      origin: parsedUrl.origin,
      method: 'GET',
      signal,
      headers: { ...headers, ...(range ? { Range: range } : {}) },
    }

    const handler = new ControlledFileHandler(ops, fd, controller, {
      expectedTotal,
      tracker: p.tracker,
      segment: isSeg ? { start: segStart, total: segTotal } : undefined,
      requireRange: isSeg,
      requestStart: isSeg ? resumeOffset : -1,
      noAbort: committed,
      abortable: controller.isAbortable ? controller.isAbortable(ops.origin) : true,
      onAdvance: p.onAdvance,
    })
    const startedAt = Date.now()
    dispatcher.dispatch(ops, handler)
    const err = await handler.wait().catch((e) => e)

    const duration = Date.now() - startedAt
    const received = handler.received
    controller.report?.({
      origin: ops.origin,
      finalUrl: handler.resolvedUrl,
      host: handler.finalHost,
      received,
      duration,
      speed: duration > 0 ? (received / duration) * 1000 : 0,
      outcome: !err ? 'completed' : isManagedAbortError(err) ? 'aborted' : 'failed',
    })

    if (!err) {
      // Defend against a mirror that completed "successfully" but
      // delivered FEWER bytes than requested (a short, otherwise-valid
      // 206, or a whole-file stream cut short). Without this check the
      // un-delivered tail stays as zero bytes on disk — a silent gap
      // that corrupts the file (e.g. empty zip entries). The expected
      // end is the segment's inclusive end + 1, or the whole-file total
      // discovered from the response headers.
      const target = isSeg ? segEnd! + 1 : handler.total
      if (target > 0 && handler.offset < target) {
        resumeOffset = Math.max(resumeOffset, handler.offset)
        if (resumes < maxResumes) {
          resumes++
          continue // resume the missing tail
        }
        lastError = new Error(
          `Incomplete download: received ${handler.offset} of ${target} bytes`,
        )
        urlIndex++
        continue
      }
      done = true
      break
    }

    signal?.throwIfAborted()

    // A mirror that ignored Range cannot be safely resumed within a
    // shared multi-segment file — bubble up to force a whole-file retry.
    if (isRangeNotSupportedError(err)) throw err

    // Carry the resume offset forward across both rerolls and URL
    // fallbacks so we never re-download bytes already on disk.
    resumeOffset = Math.max(resumeOffset, handler.offset)
    lastError = err

    if (isManagedAbortError(err)) {
      const reason = (err as ManagedAbortError).reason
      if (reason === 'slow') {
        if (resumes < maxResumes) {
          // Reroll: retry the same URL to be re-assigned a (hopefully)
          // faster mirror, resuming from where we stopped.
          resumes++
          continue
        }
        // The re-roll budget is spent. A slow-but-working connection is
        // never a hard failure — commit to finishing the next attempt
        // with the speed abort disabled so it can complete.
        committed = true
        continue
      }
      // 'ttfb' or 'stall' — NO progress: the assigned mirror is dead or
      // stuck. Try a couple of fresh assignments, then fall straight to
      // the next fallback URL (e.g. the official source) instead of
      // looping on dead mirrors and wasting the whole reroll budget.
      if (noProgress < maxNoProgress) {
        noProgress++
        continue
      }
      noProgress = 0
      committed = false
      urlIndex++
      continue
    }

    // A transient mirror failure (e.g. 403/404/5xx) on a re-assignable
    // origin is worth re-rolling — a fresh assignment usually serves the
    // bytes — rather than giving up on this URL.
    if (controller.shouldReroll?.(ops.origin, err) && resumes < maxResumes) {
      resumes++
      continue
    }

    // Terminal failure, or the reroll budget is spent: fall through to
    // the next fallback URL.
    urlIndex++
  }

  if (!done) {
    throw lastError ?? new Error('Download failed with no attempts')
  }
}

const unlinkAsync = promisify(unlink)
const ftruncateAsync = promisify(sftruncate)
const mkdir = promisify(smkdir)
const open = promisify(sopen)
const close = promisify(sclose)

/**
 * undici's retry interceptor wraps a transient socket failure by
 * re-issuing the request with `Range: bytes=<bytesConsumed>-` to resume.
 * If the origin then replies with a fresh 200 (no Range support) or a
 * Content-Range that doesn't match what we already wrote, it throws
 * `RequestRetryError` with code `UND_ERR_REQ_RETRY` and one of these
 * messages. We use this to decide whether to truncate the partial file
 * and restart the download from scratch on the same URL.
 */
function isRangeRetryError(e: any): boolean {
  if (!e) return false
  if (e.code === 'UND_ERR_REQ_RETRY') return true
  const msg = typeof e.message === 'string' ? e.message : ''
  return msg.includes('range header') || msg.includes('content-range mismatch')
}

function assignError(e: Error) {
  Error.captureStackTrace(e)
  Object.assign(e, {
    phase: 'open',
  })
}

async function openFd(output: string) {
  const fd = await open(output, 'w').catch(async (e) => {
    if (e.code === 'ENOENT') {
      await mkdir(dirname(output), { recursive: true })
      return await open(output, 'w').catch((e) => {
        assignError(e)
        throw e
      })
    }
    assignError(e)
    throw e
  })
  return fd
}
