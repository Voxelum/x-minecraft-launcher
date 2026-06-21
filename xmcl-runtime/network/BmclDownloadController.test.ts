import { describe, it, expect } from 'vitest'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { BmclDownloadController } from './BmclDownloadController'
import type { DownloadResult, DownloadSample } from '@xmcl/file-transfer'

const ORIGIN = 'https://cdn.test'

function sample(partial: Partial<DownloadSample>): DownloadSample {
  return {
    origin: ORIGIN,
    host: 'mirror-a.test',
    received: 0,
    total: 0,
    speed: 0,
    elapsed: 10_000,
    ...partial,
  }
}

function completed(speed: number, host = 'mirror-a.test', received = 10 * 1024 * 1024): DownloadResult {
  return { origin: ORIGIN, host, received, duration: 1000, speed, outcome: 'completed' }
}

function make() {
  const c = new BmclDownloadController({
    warmup: 0,
    minGlobalSamples: 2,
    minMeasureBytes: 64 * 1024,
    stallFloor: 1000,
    reconnectOverheadMs: 1000,
    abortMargin: 1,
    tau: 1e12,
  })
  c.setReassignableHosts(['cdn.test'])
  return c
}

describe('BmclDownloadController', () => {
  it('never aborts a non-reassignable origin', () => {
    const c = make()
    const s = sample({ origin: 'https://launchermeta.mojang.com', speed: 1 })
    expect(c.onSample(s)).toBe('continue')
  })

  it('aborts a stalled connection even before the model is confident', () => {
    const c = make()
    expect(c.onSample(sample({ speed: 500 }))).toBe('abort')
  })

  it('re-rolls a transient error on a reassignable origin but not a 404', () => {
    const c = make()
    // reassignable origin (cdn.test) configured in make()
    expect(c.shouldReroll(ORIGIN, new Error('socket hang up'))).toBe(true)
    expect(c.shouldReroll(ORIGIN, Object.assign(new Error('forbidden'), { statusCode: 403 }))).toBe(
      true,
    )
    // 404/410 are definitive — do not waste the reroll budget.
    expect(c.shouldReroll(ORIGIN, Object.assign(new Error('nope'), { statusCode: 404 }))).toBe(false)
    expect(c.shouldReroll(ORIGIN, Object.assign(new Error('gone'), { statusCode: 410 }))).toBe(false)
    // never reroll a non-reassignable (fixed) origin.
    expect(
      c.shouldReroll('https://libraries.minecraft.net', new Error('socket hang up')),
    ).toBe(false)
  })

  it('does not abort on the threshold until enough global samples exist', () => {
    const c = make()
    // One completed sample only — below minGlobalSamples (2).
    c.report(completed(1_000_000))
    // A slow-but-not-stalled connection should still be kept.
    expect(c.onSample(sample({ total: 10 * 1024 * 1024, received: 0, speed: 100_000 }))).toBe(
      'continue',
    )
  })

  it('aborts a connection slower than the optimal-stop threshold', () => {
    const c = make()
    c.report(completed(1_000_000))
    c.report(completed(1_000_000))
    // remaining=10MB, overhead=1s, eFresh=1MB/s -> vMin ~= 0.909 MB/s.
    expect(c.onSample(sample({ total: 10 * 1024 * 1024, received: 0, speed: 100_000 }))).toBe(
      'abort',
    )
  })

  it('keeps a connection faster than the threshold', () => {
    const c = make()
    c.report(completed(1_000_000))
    c.report(completed(1_000_000))
    expect(c.onSample(sample({ total: 10 * 1024 * 1024, received: 0, speed: 980_000 }))).toBe(
      'continue',
    )
  })

  it('ignores results too small to measure', () => {
    const c = make()
    c.report(completed(5_000_000, 'mirror-a.test', 1024)) // tiny -> ignored
    c.report(completed(5_000_000, 'mirror-a.test', 1024))
    // Model is still unconfident, so a slow connection is kept.
    expect(c.onSample(sample({ total: 10 * 1024 * 1024, received: 0, speed: 50_000 }))).toBe(
      'continue',
    )
  })

  it('persists and restores the learned model', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'xmcl-rep-'))
    try {
      const path = join(dir, 'rep.json')
      const a = make()
      a.report(completed(2_000_000))
      a.report(completed(2_000_000))
      await a.load(path) // sets persistPath; file absent is fine
      await a.save()

      const b = make()
      await b.load(path)
      // Restored model is confident and treats a slow connection as abortable.
      expect(b.onSample(sample({ total: 10 * 1024 * 1024, received: 0, speed: 100_000 }))).toBe(
        'abort',
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

const OFFICIAL = 'https://launchermeta.mojang.com'

function makeCb(opts: ConstructorParameters<typeof BmclDownloadController>[0] = {}) {
  const c = new BmclDownloadController({
    warmup: 0,
    cbThreshold: 4,
    cbCooldownMs: 30_000,
    cbProbeEvery: 1000,
    minMeasureBytes: 64 * 1024,
    ...opts,
  })
  c.setReassignableHosts(['cdn.test'])
  return c
}

function noData(origin = ORIGIN, outcome: 'aborted' | 'failed' = 'aborted'): DownloadResult {
  return { origin, host: undefined, received: 0, duration: 1000, speed: 0, outcome }
}

function completedFrom(origin: string, received = 5 * 1024 * 1024): DownloadResult {
  return { origin, host: 'h', received, duration: 1000, speed: 1_000_000, outcome: 'completed' }
}

describe('BmclDownloadController circuit breaker', () => {
  it('trips after consecutive no-data attempts and skips the CDN (never the official origin)', () => {
    const c = makeCb()
    expect(c.shouldSkip(ORIGIN)).toBe(false)
    for (let i = 0; i < 4; i++) c.report(noData())
    expect(c.shouldSkip(ORIGIN)).toBe(true)
    // A fixed (official) origin is the last resort and is never skipped.
    expect(c.shouldSkip(OFFICIAL)).toBe(false)
  })

  it('closes the breaker as soon as the CDN delivers real data again', () => {
    const c = makeCb()
    for (let i = 0; i < 4; i++) c.report(noData())
    expect(c.shouldSkip(ORIGIN)).toBe(true)
    c.report(completed(2_000_000))
    expect(c.shouldSkip(ORIGIN)).toBe(false)
  })

  it('closes the breaker when the official fallback is ALSO failing (converge back to CDN)', () => {
    const c = makeCb()
    for (let i = 0; i < 4; i++) c.report(noData())
    expect(c.shouldSkip(ORIGIN)).toBe(true)
    // The fallback we were forced onto delivers nothing either — it is no
    // better than the CDN, so reconsider the CDN immediately.
    c.report(noData(OFFICIAL, 'failed'))
    expect(c.shouldSkip(ORIGIN)).toBe(false)
  })

  it('keeps the breaker open while the official fallback is delivering', () => {
    const c = makeCb()
    for (let i = 0; i < 4; i++) c.report(noData())
    expect(c.shouldSkip(ORIGIN)).toBe(true)
    c.report(completedFrom(OFFICIAL))
    expect(c.shouldSkip(ORIGIN)).toBe(true)
  })

  it('half-open probes the CDN periodically while the breaker is open', () => {
    const c = makeCb({ cbProbeEvery: 3 })
    for (let i = 0; i < 4; i++) c.report(noData())
    const decisions = Array.from({ length: 6 }, () => c.shouldSkip(ORIGIN))
    // 1 in 3 requests is let through to probe for recovery.
    expect(decisions).toEqual([true, true, false, true, true, false])
  })
})

