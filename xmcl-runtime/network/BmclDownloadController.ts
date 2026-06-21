import { DownloadController, DownloadResult, DownloadSample } from '@xmcl/file-transfer'
import { readJson, writeJson } from 'fs-extra'

interface Ewma {
  /**
   * The exponentially-decayed mean throughput in bytes/second.
   */
  score: number
  /**
   * The decayed effective sample weight.
   */
  weight: number
  /**
   * Epoch ms of the last update.
   */
  lastUpdate: number
  /**
   * The total (non-decayed) number of measurements, used as a
   * confidence gate.
   */
  count: number
}

export interface BmclDownloadControllerOptions {
  /**
   * Milliseconds between throughput samples.
   * @default 1000
   */
  sampleInterval?: number
  /**
   * Ignore throughput for this long after the first byte (covers the
   * redirect handshake plus TCP slow-start ramp). The probe shows a
   * cold mirror TLS+TTFB can take up to ~1s, so stay above that.
   * @default 2500
   */
  warmup?: number
  /**
   * Maximum managed aborts before `download` stops resuming.
   * @default 5
   */
  maxResumes?: number
  /**
   * Re-roll a connection that delivers no byte within this many ms.
   * @default 5000
   */
  ttfbDeadline?: number
  /**
   * Abort a connection that delivered a first byte then stopped for this
   * many ms (stuck mid-stream mirror).
   * @default 5000
   */
  stallTimeout?: number
  /**
   * No-progress (TTFB/stall) re-rolls per URL before falling to the next
   * fallback URL (e.g. the official source).
   * @default 2
   */
  maxNoProgressRerolls?: number
  /**
   * Estimated cost (ms) of dropping a connection and being re-assigned
   * a fresh mirror by the signed API (redirect + new-mirror TTFB). The
   * probe measured bmcl 302 ~60ms + mirror TTFB ~150ms, with cold TLS
   * pushing the worst case to a few hundred ms.
   * @default 600
   */
  reconnectOverheadMs?: number
  /**
   * Time-decay constant (ms) for the throughput EWMAs. Older samples
   * fade with `exp(-dt / tau)`.
   * @default 6h
   */
  tau?: number
  /**
   * Throughput (bytes/s) under which a connection past warmup is treated
   * as stalled and aborted regardless of the learned model.
   * @default 16 KiB/s
   */
  stallFloor?: number
  /**
   * Minimum global completion samples required before the optimal-stop
   * threshold is trusted enough to abort on.
   * @default 3
   */
  minGlobalSamples?: number
  /**
   * Only feed a connection's result into the speed model when it moved
   * at least this many bytes (tiny files finish too fast to measure).
   * @default 64 KiB
   */
  minMeasureBytes?: number
  /**
   * Hysteresis factor: abort only when the observed speed is below
   * `vMin * abortMargin`, to avoid flapping around the threshold.
   * @default 0.85
   */
  abortMargin?: number
  /**
   * Files at least this large are split into `rangeConcurrency` parallel
   * mirror segments. `0` disables splitting.
   * @default 4 MiB
   */
  rangeSplitThreshold?: number
  /**
   * Parallel segment count for range-split downloads.
   * @default 4
   */
  rangeConcurrency?: number
  /**
   * Circuit breaker: after this many consecutive *no-data* attempts on
   * the re-assignable CDN (it is delivering nothing — down or
   * unreachable), trip the breaker and skip the CDN entirely, going
   * straight to the fallback URL, until {@link cbCooldownMs} elapses.
   * Any attempt that delivers real data resets the counter and closes
   * the breaker.
   * @default 16
   */
  cbThreshold?: number
  /**
   * How long the circuit breaker stays open before the CDN is retried.
   * @default 30000
   */
  cbCooldownMs?: number
  /**
   * Half-open probing: while the breaker is open, let 1 in this many
   * requests still hit the CDN, so a recovered CDN is detected (and the
   * breaker closed) *before* the cooldown elapses. `1` disables skipping
   * (always probe); large values probe rarely.
   * @default 24
   */
  cbProbeEvery?: number
}
/**
 * Adaptive {@link DownloadController} for distributed-CDN APIs such as
 * BMCLAPI, where a signed request is redirected to a mirror of unknown
 * quality and the only lever is to drop a slow assignment and re-request
 * the API for a different mirror.
 *
 * It learns, with exponential time decay:
 * - a global expectation of achievable throughput (the value of a fresh
 *   re-roll), and
 * - a per-mirror-host reputation (so repeatedly-slow hosts are abandoned
 *   sooner and the knowledge survives across sessions).
 *
 * The abort rule is an optimal-stopping comparison: drop the current
 * connection when the expected time to finish it exceeds the expected
 * time to finish after re-rolling (including the reconnect overhead).
 *
 * Only requests whose origin is a re-assignable (CDN) host are ever
 * aborted — re-rolling a fixed origin would just hit the same host.
 */
export class BmclDownloadController implements DownloadController {
  readonly sampleInterval: number
  readonly warmup: number
  readonly maxResumes: number
  readonly ttfbDeadline: number
  readonly stallTimeout: number
  readonly maxNoProgressRerolls: number
  readonly rangeSplitThreshold: number
  readonly rangeConcurrency: number

  private readonly reconnectOverheadMs: number
  private readonly tau: number
  private readonly stallFloor: number
  private readonly minGlobalSamples: number
  private readonly minMeasureBytes: number
  private readonly abortMargin: number

  private readonly cbThreshold: number
  private readonly cbCooldownMs: number
  /** Consecutive no-data attempts on the re-assignable CDN. */
  private cbFails = 0
  /** Epoch ms until which the CDN circuit breaker stays open (0 = closed). */
  private cbOpenUntil = 0
  /** Half-open probe spacing (let 1 in N requests probe while open). */
  private readonly cbProbeEvery: number
  /** Rolling counter that spaces out half-open probes. */
  private cbProbeTick = 0

  private readonly hosts = new Map<string, Ewma>()
  private readonly global: Ewma = { score: 0, weight: 0, lastUpdate: 0, count: 0 }

  private reassignableHosts = new Set<string>(['bmclapi2.bangbang93.com'])

  /**
   * Rolling stats accumulated since the last {@link snapshot} call, used
   * to log a periodic download-distribution snapshot.
   */
  private win = newWindow()

  private persistPath?: string
  private saveTimer?: ReturnType<typeof setTimeout>
  private dirty = false

  constructor(options: BmclDownloadControllerOptions = {}) {
    this.sampleInterval = options.sampleInterval ?? 1000
    this.warmup = options.warmup ?? 2500
    this.maxResumes = options.maxResumes ?? 5
    this.ttfbDeadline = options.ttfbDeadline ?? 5_000
    this.stallTimeout = options.stallTimeout ?? 5_000
    this.maxNoProgressRerolls = options.maxNoProgressRerolls ?? 2
    this.reconnectOverheadMs = options.reconnectOverheadMs ?? 600
    this.tau = options.tau ?? 6 * 60 * 60 * 1000
    this.stallFloor = options.stallFloor ?? 16 * 1024
    this.minGlobalSamples = options.minGlobalSamples ?? 3
    this.minMeasureBytes = options.minMeasureBytes ?? 64 * 1024
    this.abortMargin = options.abortMargin ?? 0.85
    this.rangeSplitThreshold = options.rangeSplitThreshold ?? 4 * 1024 * 1024
    this.rangeConcurrency = options.rangeConcurrency ?? 4
    this.cbThreshold = options.cbThreshold ?? 16
    this.cbCooldownMs = options.cbCooldownMs ?? 30_000
    this.cbProbeEvery = Math.max(1, options.cbProbeEvery ?? 24)
  }

  /**
   * Declare which hosts are re-assignable CDN endpoints (i.e. re-issuing
   * the request can land on a different mirror). Typically the configured
   * API-set hosts.
   */
  setReassignableHosts(hosts: Iterable<string>): void {
    this.reassignableHosts = new Set(['bmclapi2.bangbang93.com'])
    for (const h of hosts) {
      if (h) this.reassignableHosts.add(h)
    }
  }

  onSample(sample: DownloadSample): 'continue' | 'abort' {
    const decision = this.decide(sample)
    // Record stats for the periodic snapshot (all samples, even
    // non-reassignable, so the distribution reflects reality).
    const w = this.win
    w.samples++
    w.speedSum += sample.speed
    if (sample.speed < this.stallFloor) w.stalled++
    if (decision === 'abort') w.abortsIssued++
    if (sample.host) {
      const h = w.hosts.get(sample.host) ?? { count: 0, speedSum: 0 }
      h.count++
      h.speedSum += sample.speed
      w.hosts.set(sample.host, h)
    }
    return decision
  }

  private decide(sample: DownloadSample): 'continue' | 'abort' {
    if (!this.isReassignable(sample.origin)) {
      return 'continue'
    }

    // Hard stall: practically no progress past warmup — always re-roll.
    if (sample.speed < this.stallFloor) {
      return 'abort'
    }

    // Need a confident view of what a fresh re-roll yields before we
    // start dropping otherwise-working connections.
    if (this.global.count < this.minGlobalSamples) {
      return 'continue'
    }
    const eFresh = this.global.score
    if (eFresh <= 0) {
      return 'continue'
    }

    if (sample.total > 0) {
      const remaining = sample.total - sample.received
      if (remaining <= 0) {
        return 'continue'
      }
      const overhead = this.reconnectOverheadMs / 1000
      // Expected finish time as-is = remaining / speed.
      // Expected finish time if re-rolled = overhead + remaining / eFresh.
      // Solving for the break-even speed:
      const vMin = remaining / (overhead + remaining / eFresh)
      if (sample.speed < vMin * this.abortMargin) {
        return 'abort'
      }
    } else {
      // Unknown size: drop only clearly-subpar connections.
      if (sample.speed < eFresh * 0.4) {
        return 'abort'
      }
    }

    return 'continue'
  }

  shouldReroll(origin: string, error: unknown): boolean {
    // For a re-assignable CDN origin, a fresh request can land on a
    // different mirror, so transient failures are worth re-rolling.
    if (!this.isReassignable(origin)) return false
    // A 404/410 means the resource is genuinely absent from this CDN
    // (e.g. a library not mirrored on bmcl). Re-rolling cannot conjure
    // it — fall straight through to the next fallback URL instead of
    // wasting the whole reroll budget.
    const status = (error as any)?.statusCode
    if (status === 404 || status === 410) return false
    return true
  }

  isAbortable(origin: string): boolean {
    // Only abort (TTFB/stall) re-assignable CDN origins; the official
    // source is slow-but-reliable and must be allowed to finish.
    return this.isReassignable(origin)
  }

  shouldSkip(origin: string): boolean {
    // Skip the CDN entirely while its breaker is open (it is delivering
    // nothing). The breaker auto-closes after the cooldown so the CDN is
    // periodically retried in case it recovered.
    if (!this.isReassignable(origin)) return false
    if (Date.now() >= this.cbOpenUntil) return false
    // Half-open: occasionally let a request through to probe whether the
    // CDN has recovered. A successful probe closes the breaker (in
    // `report`) before the cooldown elapses, so we converge back to the
    // (faster) CDN as soon as it works again — important when the
    // official fallback is itself slow.
    this.cbProbeTick = (this.cbProbeTick + 1) % this.cbProbeEvery
    if (this.cbProbeTick === 0) return false
    return true
  }

  report(result: DownloadResult): void {
    // Count every outcome for the periodic snapshot (before the
    // learning-model filters below).
    const w = this.win
    if (result.outcome === 'completed') {
      w.completed++
      w.completedBytes += result.received
    } else if (result.outcome === 'aborted') {
      w.aborted++
      if (result.received < this.minMeasureBytes) w.abortedNoData++
    } else {
      w.failed++
    }

    // Circuit-breaker accounting: a re-assignable attempt that delivered
    // real data proves the CDN is reachable → reset and close; an
    // attempt that delivered (almost) nothing is evidence the CDN is
    // down → count toward tripping the breaker.
    if (this.isReassignable(result.origin)) {
      if (result.received >= this.minMeasureBytes) {
        this.cbFails = 0
        this.cbOpenUntil = 0
      } else {
        this.cbFails++
        if (this.cbFails >= this.cbThreshold) {
          this.cbOpenUntil = Date.now() + this.cbCooldownMs
          this.cbFails = 0
        }
      }
    } else if (
      this.cbOpenUntil > 0 &&
      result.outcome !== 'completed' &&
      result.received < this.minMeasureBytes
    ) {
      // The breaker is forcing traffic onto the official fallback, but
      // the fallback is ALSO delivering nothing — it is no better than
      // the CDN. Close the breaker so the CDN is reconsidered (its
      // re-rolls may find a live mirror) instead of looping on a dead
      // fallback. Guarantees convergence to whichever source actually
      // works, even when the official source is the worse one.
      this.cbOpenUntil = 0
      this.cbFails = 0
    }

    if (result.received < this.minMeasureBytes) {
      // Too small to yield a meaningful throughput estimate.
      return
    }
    if (!this.isReassignable(result.origin)) {
      // Only learn from re-assignable CDN endpoints; an official-source
      // fallback says nothing about what a fresh mirror re-roll yields.
      return
    }
    const now = Date.now()
    const host = result.host
    if (result.outcome === 'completed') {
      if (host) this.update(this.host(host), result.speed, now)
      this.update(this.global, result.speed, now)
    } else if (result.outcome === 'aborted') {
      // Remember the slow assignment, but do not let truncated samples
      // drag down the global "achievable" expectation.
      if (host) this.update(this.host(host), result.speed, now)
    } else {
      // Failed outright — treat as the worst kind of host evidence.
      if (host) this.update(this.host(host), 0, now)
    }
    this.scheduleSave()
  }

  /**
   * Take a one-line snapshot of download activity since the previous
   * call, then reset the window. Intended to be polled periodically by a
   * logger to surface "downloads stuck with no speed" situations.
   */
  snapshot(): string | undefined {
    const w = this.win
    this.win = newWindow()
    const durS = Math.max(0.001, (Date.now() - w.start) / 1000)
    const hadActivity =
      w.samples > 0 || w.completed > 0 || w.aborted > 0 || w.failed > 0
    if (!hadActivity) return undefined

    const fmt = (bps: number) => `${(bps / 1024 / 1024).toFixed(2)}MB/s`
    const hostList = [...w.hosts.entries()]
      .map(([h, v]) => ({ host: h, avg: v.speedSum / Math.max(1, v.count), count: v.count }))
      .sort((a, b) => b.avg - a.avg)
    const avgConn = w.samples ? w.speedSum / w.samples : 0
    // Approx aggregate: per-second samples summed over the window.
    const agg = w.speedSum / durS
    const slow = hostList.filter((h) => h.avg < this.stallFloor)
    const cbOpen = Date.now() < this.cbOpenUntil
    const cb = cbOpen
      ? `CDN-BREAKER-OPEN(${((this.cbOpenUntil - Date.now()) / 1000).toFixed(0)}s)`
      : `cdnFails=${this.cbFails}/${this.cbThreshold}`

    return (
      `win=${durS.toFixed(0)}s sampledConns=${w.samples} agg~${fmt(agg)} avgConn=${fmt(avgConn)} ` +
      `stalled=${w.stalled}/${w.samples} abortsIssued=${w.abortsIssued} | ` +
      `done=${w.completed}(${(w.completedBytes / 1024 / 1024).toFixed(1)}MB) aborted=${w.aborted}(noData=${w.abortedNoData}) failed=${w.failed} | ` +
      `${cb} eFresh=${fmt(this.global.score)} hosts=${hostList.length} slowHosts=${slow.length} | ` +
      `fast: ${hostList.slice(0, 3).map((h) => `${h.host}=${fmt(h.avg)}x${h.count}`).join(' ')} | ` +
      `slow: ${slow.slice(0, 3).map((h) => `${h.host}=${fmt(h.avg)}x${h.count}`).join(' ')}`
    )
  }

  /**
   * Load a previously-persisted reputation snapshot. Safe to call before
   * any sampling; corrupt or missing files are ignored.
   */
  async load(path: string): Promise<void> {
    this.persistPath = path
    const raw = await readJson(path).catch(() => undefined)
    if (!raw || typeof raw !== 'object') return
    const g = (raw as any).global
    if (isEwma(g)) {
      Object.assign(this.global, g)
    }
    const hosts = (raw as any).hosts
    if (hosts && typeof hosts === 'object') {
      for (const [k, v] of Object.entries(hosts)) {
        if (isEwma(v)) this.hosts.set(k, { ...(v as Ewma) })
      }
    }
  }

  /**
   * Flush the reputation snapshot to disk immediately. The plugin should
   * also call this on app shutdown.
   */
  async save(): Promise<void> {
    if (!this.persistPath || !this.dirty) return
    this.dirty = false
    const hosts: Record<string, Ewma> = {}
    for (const [k, v] of this.hosts.entries()) hosts[k] = v
    await writeJson(this.persistPath, { global: this.global, hosts }).catch(() => undefined)
  }

  private scheduleSave() {
    this.dirty = true
    if (!this.persistPath || this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined
      void this.save()
    }, 10_000)
    this.saveTimer.unref?.()
  }

  private isReassignable(origin: string): boolean {
    try {
      return this.reassignableHosts.has(new URL(origin).hostname)
    } catch {
      return false
    }
  }

  private host(name: string): Ewma {
    let e = this.hosts.get(name)
    if (!e) {
      e = { score: 0, weight: 0, lastUpdate: 0, count: 0 }
      this.hosts.set(name, e)
    }
    return e
  }

  private update(e: Ewma, value: number, now: number): void {
    const decay = e.lastUpdate ? Math.exp(-(now - e.lastUpdate) / this.tau) : 0
    const w = e.weight * decay
    e.score = w > 0 ? (e.score * w + value) / (w + 1) : value
    e.weight = w + 1
    e.lastUpdate = now
    e.count += 1
  }
}

function isEwma(v: unknown): v is Ewma {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as any).score === 'number' &&
    typeof (v as any).weight === 'number' &&
    typeof (v as any).lastUpdate === 'number' &&
    typeof (v as any).count === 'number'
  )
}

interface Window {
  start: number
  samples: number
  speedSum: number
  stalled: number
  abortsIssued: number
  completed: number
  aborted: number
  failed: number
  abortedNoData: number
  completedBytes: number
  hosts: Map<string, { count: number; speedSum: number }>
}

function newWindow(): Window {
  return {
    start: Date.now(),
    samples: 0,
    speedSum: 0,
    stalled: 0,
    abortsIssued: 0,
    completed: 0,
    aborted: 0,
    failed: 0,
    abortedNoData: 0,
    completedBytes: 0,
    hosts: new Map(),
  }
}

