/**
 * A throughput observation for a single in-flight download connection.
 *
 * Emitted periodically (every `DownloadController.sampleInterval` ms)
 * while the body is streaming, so a controller can decide whether the
 * assigned host is fast enough to keep.
 */
export interface DownloadSample {
  /**
   * The origin the request was dispatched to (e.g. the BMCLAPI origin,
   * before any redirect).
   */
  origin: string
  /**
   * The final URL after following redirects, if known. For a CDN that
   * redirects to a mirror this is the mirror URL actually serving bytes.
   */
  finalUrl?: string
  /**
   * The final host after following redirects, if known. Use this as the
   * reputation key for a distributed CDN.
   */
  host?: string
  /**
   * Bytes of this download (or segment) already on disk, including bytes
   * from earlier resumed attempts. `total - received` is the remaining
   * work, which the optimal-stop rule compares against.
   */
  received: number
  /**
   * Total expected bytes for this download (or segment), or 0 if unknown.
   */
  total: number
  /**
   * Throughput over the most recent sampling window, in bytes/second.
   */
  speed: number
  /**
   * Milliseconds elapsed since the first body byte of this connection
   * arrived. Useful to ignore the TCP slow-start ramp.
   */
  elapsed: number
}

export type DownloadDecision = 'continue' | 'abort'

/**
 * The outcome reported to the controller when a single connection ends,
 * whether it completed, was aborted by the controller, or failed.
 */
export interface DownloadResult {
  origin: string
  finalUrl?: string
  host?: string
  /**
   * Total bytes transferred on this connection.
   */
  received: number
  /**
   * Wall-clock duration of the connection, in milliseconds, measured
   * from the first body byte.
   */
  duration: number
  /**
   * Average throughput in bytes/second over the connection lifetime.
   */
  speed: number
  outcome: 'completed' | 'aborted' | 'failed'
}

/**
 * A pluggable strategy that observes a download's per-connection
 * throughput and may request a *managed abort* — which makes `download`
 * resume the transfer (via an HTTP `Range` request) on a fresh
 * connection instead of failing the whole download.
 *
 * This is the seam the BMCLAPI coordinator plugs into to drop slow
 * mirror assignments and re-request the signed API for a (hopefully)
 * faster host. When no controller is supplied to `download`, behaviour
 * is byte-for-byte unchanged.
 */
export interface DownloadController {
  /**
   * Minimum milliseconds between throughput samples.
   * @default 1000
   */
  readonly sampleInterval?: number
  /**
   * Ignore the connection's throughput (never abort) until this many
   * milliseconds have elapsed since the first byte. Guards against
   * killing a healthy connection during TCP slow-start.
   * @default 0
   */
  readonly warmup?: number
  /**
   * Maximum number of managed aborts before `download` stops resuming
   * and surfaces the underlying failure. Bounds worst-case rerolls.
   * @default 5
   */
  readonly maxResumes?: number
  /**
   * Maximum *no-progress* re-rolls (TTFB/stall, i.e. dead/stuck mirrors)
   * to attempt on one URL before falling through to the next fallback
   * URL (e.g. the official source). Keeps a dead CDN from blocking the
   * download indefinitely. (Default applied by `download`: 2.)
   */
  readonly maxNoProgressRerolls?: number
  /**
   * If no body byte arrives within this many ms of starting a connection
   * (covering connect + redirect + TTFB), trigger a managed abort so a
   * dead/blackholed mirror is re-rolled quickly instead of waiting for
   * the dispatcher's much longer headers/body timeout. `0` disables it.
   * @default 0
   */
  readonly ttfbDeadline?: number
  /**
   * After the first byte, if no further byte arrives within this many ms,
   * treat the connection as stalled and abort it (a mid-stream stuck
   * mirror). Active even in the committed finishing phase. `0` disables.
   * @default 0
   */
  readonly stallTimeout?: number
  /**
   * Files at least this large are split into `rangeConcurrency` byte
   * segments fetched in parallel — each a separate request, so on a
   * distributed CDN each segment streams from a different mirror at
   * once. `0` disables splitting. (Default applied by `download`: 4 MiB.)
   */
  readonly rangeSplitThreshold?: number
  /**
   * Number of parallel segments to use when range-splitting a large
   * file. (Default applied by `download`: 4.)
   */
  readonly rangeConcurrency?: number
  /**
   * Inspect a throughput sample and decide whether to keep the
   * connection (`'continue'`) or trigger a managed abort + resume
   * (`'abort'`).
   */
  onSample?(sample: DownloadSample): DownloadDecision
  /**
   * Decide whether a *failed* attempt (HTTP error, network error) on the
   * given origin should be retried by re-rolling — i.e. re-requesting the
   * same URL to be re-assigned a different mirror — rather than treated
   * as terminal. For a distributed CDN a 403/404/5xx from one mirror
   * often succeeds on the next assignment. Bounded by `maxResumes`.
   */
  shouldReroll?(origin: string, error: unknown): boolean
  /**
   * Whether the given origin is worth aborting (TTFB/stall) and
   * re-rolling — i.e. a re-assignable CDN whose next request can land on
   * a different mirror. Non-re-assignable origins (e.g. the official
   * source) are NOT aborted on TTFB/stall: re-rolling cannot help and
   * the slow-but-working source is the last resort. Defaults to `true`
   * (abort everything) when not implemented.
   */
  isAbortable?(origin: string): boolean
  /**
   * Whether requests to the given origin should be skipped *entirely*
   * right now — a circuit breaker. When a re-assignable CDN is failing
   * hard (delivering no data), `download` skips its URLs and goes
   * straight to a fallback (e.g. the official source) until the breaker
   * resets. `download` never skips the last remaining URL. Defaults to
   * never-skip when not implemented.
   */
  shouldSkip?(origin: string): boolean
  /**
   * Receive the final outcome of a single connection, for updating a
   * reputation / speed model.
   */
  report?(result: DownloadResult): void
}

const kManagedAbort = Symbol('ManagedAbort')

/**
 * Why a connection was aborted by the controller/handler:
 * - `ttfb`: connected/redirected but delivered no first byte in time.
 * - `stall`: delivered a first byte then stopped making progress.
 * - `slow`: making progress, but too slow vs. the learned model.
 *
 * `ttfb` and `stall` mean *no progress* (a dead/stuck mirror) and should
 * be abandoned fast; `slow` is a tuning decision.
 */
export type ManagedAbortReason = 'ttfb' | 'stall' | 'slow'

/**
 * Error used to signal a controller-requested abort. `download`
 * recognises it and resumes the transfer instead of failing.
 */
export class ManagedAbortError extends Error {
  readonly [kManagedAbort] = true
  readonly reason: ManagedAbortReason

  constructor(reason: ManagedAbortReason = 'slow') {
    super(`Download connection aborted by controller (${reason})`)
    this.name = 'ManagedAbortError'
    this.reason = reason
  }
}

export function isManagedAbortError(e: unknown): e is ManagedAbortError {
  return !!e && typeof e === 'object' && (e as any)[kManagedAbort] === true
}

const kRangeUnsupported = Symbol('RangeNotSupported')

/**
 * Thrown by a segment download when a ranged request is answered with a
 * full `200` response (the mirror ignored `Range`). The orchestrator
 * catches it and falls back to a single whole-file stream so the shared
 * file is not corrupted by overlapping writes.
 */
export class RangeNotSupportedError extends Error {
  readonly [kRangeUnsupported] = true

  constructor() {
    super('Server ignored the Range header and returned a full response')
    this.name = 'RangeNotSupportedError'
  }
}

export function isRangeNotSupportedError(e: unknown): e is RangeNotSupportedError {
  return !!e && typeof e === 'object' && (e as any)[kRangeUnsupported] === true
}
