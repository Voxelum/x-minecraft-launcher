import { Dispatcher } from 'undici'
import { DownloadController, ManagedAbortError, RangeNotSupportedError } from './controller'
import { FileHandler } from './file_handler'
import { ProgressTracker, ProgressTrackerSingle } from './progress'

export interface ControlledHandlerParams {
  /**
   * The whole-file expected size, used to seed progress before headers
   * arrive. Ignored once the real size is known.
   */
  expectedTotal?: number
  /**
   * Single-stream progress tracker. Mutually exclusive with `onAdvance`
   * (segment mode aggregates progress externally).
   */
  tracker?: ProgressTrackerSingle
  /**
   * When set, this connection is responsible only for `[start, start +
   * total)` of the file (a range segment). The optimal-stop decision is
   * then made relative to the segment, not the whole file.
   */
  segment?: { start: number; total: number }
  /**
   * Require a partial (`206`) response. If the server answers a ranged
   * request with a full `200`, reject with {@link RangeNotSupportedError}
   * instead of clobbering the shared file from offset 0.
   */
  requireRange?: boolean
  /**
   * The absolute byte offset this request asked the server to start at
   * (the `Range: bytes=<start>-` value). If a `206` comes back starting
   * somewhere else, the mirror mis-honoured the range; writing it would
   * land bytes at the wrong offset, so the response is rejected.
   */
  requestStart?: number
  /**
   * Commit to finishing this connection: ignore the controller's
   * speed-based abort and the TTFB deadline (a managed abort must never
   * be the terminal failure once the re-roll budget is spent). Real
   * network/HTTP errors still propagate.
   */
  noAbort?: boolean
  /**
   * Whether this origin may be aborted on TTFB/stall (a re-assignable
   * CDN). When false (e.g. the official source) the connection is left
   * to finish or hit the dispatcher's own timeout. Default true.
   */
  abortable?: boolean
  /**
   * Called after each write with the new absolute file offset, so a
   * multi-segment orchestrator can aggregate overall progress.
   */
  onAdvance?: (absolutePosition: number) => void
}

/**
 * A single-connection file handler that periodically samples its own
 * throughput and asks a {@link DownloadController} whether to keep the
 * connection. When the controller returns `'abort'`, the handler
 * rejects with a {@link ManagedAbortError}, which `download` turns into
 * a resumed retry (re-roll) rather than a hard failure.
 *
 * It can fetch either the whole file (single resumable stream) or a
 * single byte-range segment of it (for range-split-across-mirrors). In
 * both cases an abort has a well-defined resume offset (`this.position`).
 */
export class ControlledFileHandler extends FileHandler {
  private readonly origin: string
  private readonly path: string
  private totalSize = 0
  private finalUrl?: string
  private host?: string

  private readonly segStart: number
  private readonly segTotal: number
  private readonly requireRange: boolean
  private readonly requestStart: number
  private readonly noAbort: boolean
  private readonly abortable: boolean
  private readonly advance?: (absolutePosition: number) => void

  private firstByteAt = 0
  private lastByteAt = 0
  private windowStart = 0
  private windowBytes = 0
  private timer?: ReturnType<typeof setInterval>
  private ttfbTimer?: ReturnType<typeof setTimeout>
  private rangeRejected = false

  private readonly progressInfo: ProgressTracker = { url: '', total: 0, progress: 0 }

  constructor(
    options: Dispatcher.DispatchOptions & { signal?: AbortSignal },
    fd: number,
    private readonly controller: DownloadController,
    params: ControlledHandlerParams = {},
  ) {
    super(options.signal, fd)
    this.origin = options.origin as string
    this.path = options.path as string
    this.segStart = params.segment?.start ?? 0
    this.segTotal = params.segment?.total ?? 0
    this.requireRange = params.requireRange ?? false
    this.requestStart = params.requestStart ?? -1
    this.noAbort = params.noAbort ?? false
    this.abortable = params.abortable ?? true
    this.advance = params.onAdvance

    this.totalSize = this.segTotal || params.expectedTotal || 0
    this.progressInfo.total = params.expectedTotal ?? this.totalSize
    this.progressInfo.url = this.origin + this.path
    if (params.tracker) {
      params.tracker.setAccessor(this.progressInfo)
    }
    this.onWritten = () => {
      this.progressInfo.progress = this.position
      this.advance?.(this.position)
    }
    this.resolvers.promise.catch(() => {}).finally(() => this.clearTimers())

    // The TTFB deadline stays active even in committed mode: a mirror
    // that delivers no first byte is dead and must always be abandoned.
    // Only re-assignable origins are worth abandoning, though.
    const ttfb = controller.ttfbDeadline ?? 0
    if (ttfb > 0 && this.abortable) {
      this.ttfbTimer = setTimeout(() => {
        if (this.firstByteAt === 0) {
          // Connected (or redirected) but no bytes — re-roll fast.
          this.clearTimers()
          this.resolvers.reject(new ManagedAbortError('ttfb'))
        }
      }, ttfb)
      this.ttfbTimer.unref?.()
    }
  }

  protected override onHeaderParsed(_acceptRanges: boolean, total: number): void {
    if (this.requireRange && this.statusCode === 200) {
      // The mirror ignored Range and is about to stream the whole file
      // from offset 0 — refuse before any byte lands on the shared fd.
      this.rangeRejected = true
      this.clearTimers()
      this.resolvers.reject(new RangeNotSupportedError())
      return
    }
    if (
      this.requireRange &&
      this.statusCode === 206 &&
      this.requestStart >= 0 &&
      this.start !== this.requestStart
    ) {
      // The mirror returned a different range than requested; writing it
      // would place bytes at the wrong offset and gap the region we
      // asked for. Reject so the caller re-rolls / falls back cleanly.
      this.rangeRejected = true
      this.clearTimers()
      this.resolvers.reject(new RangeNotSupportedError())
      return
    }
    if (!this.segTotal && total) {
      this.totalSize = total
      this.progressInfo.total = total
    }
    const history = this.context?.history
    if (history && history.length > 0) {
      const last = history[history.length - 1]
      this.finalUrl = last.toString()
      this.host = last.host
      this.progressInfo.url = this.finalUrl
    }
  }

  override onData(chunk: Buffer): boolean {
    if (this.rangeRejected) {
      return false
    }
    const now = Date.now()
    this.lastByteAt = now
    if (this.firstByteAt === 0) {
      this.firstByteAt = now
      this.windowStart = now
      this.clearTtfb()
      this.startSampling()
    }
    this.windowBytes += chunk.length
    return super.onData(chunk)
  }

  override onComplete(trailers: string[] | null): void {
    this.clearTimers()
    super.onComplete(trailers)
  }

  override onError(err: Error): void {
    this.clearTimers()
    super.onError(err)
  }

  /**
   * Absolute file offset reached so far on this connection. Used as the
   * resume offset for the next attempt.
   */
  get offset(): number {
    return this.position
  }

  /**
   * Bytes received on this connection alone (excluding bytes already on
   * disk from a previous resumed attempt).
   */
  get received(): number {
    return this.position - this.start
  }

  get finalHost(): string | undefined {
    return this.host
  }

  get resolvedUrl(): string | undefined {
    return this.finalUrl
  }

  get total(): number {
    return this.totalSize
  }

  private startSampling() {
    const interval = this.controller.sampleInterval ?? 1000
    this.timer = setInterval(() => this.sample(), interval)
    // Do not keep the event loop alive solely for sampling.
    this.timer.unref?.()
  }

  private clearTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = undefined
    }
  }

  private clearTtfb() {
    if (this.ttfbTimer) {
      clearTimeout(this.ttfbTimer)
      this.ttfbTimer = undefined
    }
  }

  private clearTimers() {
    this.clearTimer()
    this.clearTtfb()
  }

  private sample() {
    const now = Date.now()
    const windowMs = now - this.windowStart
    const speed = windowMs > 0 ? (this.windowBytes / windowMs) * 1000 : 0
    this.windowBytes = 0
    this.windowStart = now

    // Stall watchdog: first byte arrived, then no byte for stallTimeout.
    // A stuck mid-stream mirror must be abandoned even in committed mode
    // (otherwise the download hangs forever with no progress). Only for
    // re-assignable origins — the official source is left to finish.
    const stallTimeout = this.controller.stallTimeout ?? 0
    if (
      this.abortable &&
      stallTimeout > 0 &&
      this.lastByteAt > 0 &&
      now - this.lastByteAt > stallTimeout
    ) {
      this.clearTimers()
      this.resolvers.reject(new ManagedAbortError('stall'))
      return
    }

    // In committed mode we still sample (so report() sees throughput) and
    // keep the stall watchdog above, but never abort merely for slowness.
    if (this.noAbort) {
      return
    }

    const elapsed = now - this.firstByteAt
    if (elapsed < (this.controller.warmup ?? 0)) {
      return
    }

    // For a segment, the decision is made relative to the segment's own
    // remaining bytes; for a whole-file stream, relative to the file.
    const inSegment = this.segTotal > 0
    const total = inSegment ? this.segTotal : this.totalSize
    const received = inSegment ? this.position - this.segStart : this.position

    const decision = this.controller.onSample?.({
      origin: this.origin,
      finalUrl: this.finalUrl,
      host: this.host,
      received,
      total,
      speed,
      elapsed,
    })

    if (decision === 'abort') {
      this.clearTimers()
      // Rejecting the resolver triggers the undici abort wired up in the
      // base FileHandler constructor; the partial bytes already written
      // stay on disk for the resumed retry.
      this.resolvers.reject(new ManagedAbortError('slow'))
    }
  }
}
