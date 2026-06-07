import { close as sclose, ftruncate as sftruncate, mkdir as smkdir, open as sopen, unlink } from 'fs'
import { dirname } from 'path'
import { Dispatcher } from 'undici'
import { promisify } from 'util'
import { getDefaultAgent } from './agent'
import { ProgressTrackerMultiple, ProgressTrackerSingle } from './progress'
import { RangeRequestHandler } from './range_handler'
import { RangePolicy, resolveRangePolicy } from './range_policy'
import { decorateError } from './error'

export interface DownloadBaseOptions {
  rangePolicy?: RangePolicy
  dispatcher?: Dispatcher
}

export function getDownloadBaseOptions(options?: DownloadBaseOptions) {
  return {
    dispatcher: options?.dispatcher || getDefaultAgent(),
    rangePolicy: resolveRangePolicy(options?.rangePolicy),
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
  const { dispatcher, rangePolicy } = getDownloadBaseOptions(options)

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
