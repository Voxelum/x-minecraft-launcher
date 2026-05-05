import { rename, close as sclose, mkdir as smkdir, open as sopen, unlink } from 'fs'
import { dirname } from 'path'
import { Dispatcher } from 'undici'
import { promisify } from 'util'
import { isNativeError } from 'util/types'
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
   * Will first download to pending file and then rename to actual file
   */
  pendingFile?: string
  /**
   * The expected total size of the file.
   */
  expectedTotal?: number
}

export type DownloadMultipleOption = Pick<
  DownloadOptions,
  'url' | 'headers' | 'destination' | 'pendingFile' | 'expectedTotal'
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
  const pendingFile = options.pendingFile
  const signal = options.signal
  const expectedTotal = options.expectedTotal
  const { dispatcher, rangePolicy } = getDownloadBaseOptions(options)

  // Check if already aborted before opening file
  signal?.throwIfAborted()

  if (tracker && expectedTotal) {
    tracker.expectedTotal = expectedTotal
  }

  const fd = await openFd(options.pendingFile || options.destination)
  signal?.throwIfAborted()
  const errors = []

  try {
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
      const handler = new RangeRequestHandler(ops, dispatcher, fd, rangePolicy, tracker)
      dispatcher.dispatch(ops, handler)
      const err = await handler.wait().catch((e) => e)
      if (!err) {
        errors.length = 0
        break
      }
      signal?.throwIfAborted()
      errors.push(err)
    }

    if (errors.length > 0) {
      if (errors.length === 1) {
        throw errors[0]
      }
      throw new AggregateError(errors, 'All urls failed to download')
    }

    if (pendingFile) {
      await renameAsync(pendingFile, destination).catch((e) => {
        if (isNativeError(e) && 'code' in e && e.code === 'EEXIST') {
          return unlinkAsync(destination).then(() => renameAsync(pendingFile, destination))
        }
      })
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
const renameAsync = promisify(rename)
const mkdir = promisify(smkdir)
const open = promisify(sopen)
const close = promisify(sclose)

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
