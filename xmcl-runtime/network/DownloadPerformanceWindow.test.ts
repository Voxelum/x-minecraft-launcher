import { describe, expect, it } from 'vitest'
import { DownloadPerformanceWindow } from './DownloadPerformanceWindow'

describe('DownloadPerformanceWindow', () => {
  it('aggregates active wall-clock throughput without retaining raw samples', () => {
    const window = new DownloadPerformanceWindow()
    window.add({ bytes: 0, duration: 1000, speed: 0, active: 0, pending: 0, limit: 64 })
    window.add({ bytes: 512 * 1024, duration: 1000, speed: 512 * 1024, active: 64, pending: 10, limit: 64 })
    window.add({ bytes: 2 * 1024 * 1024, duration: 1000, speed: 2 * 1024 * 1024, active: 32, pending: 0, limit: 64 })
    window.add({ bytes: 4 * 1024 * 1024, duration: 1000, speed: 4 * 1024 * 1024, active: 1, pending: 0, limit: 64 })

    expect(window.flush()).toMatchObject({
      aggregateBodyBytes: 6.5 * 1024 * 1024,
      networkActiveMs: 3000,
      p10AggregateSpeedBps: 512 * 1024,
      p50AggregateSpeedBps: 2 * 1024 * 1024,
      p90AggregateSpeedBps: 4 * 1024 * 1024,
      below1MiBpsMs: 1000,
      below2MiBpsMs: 1000,
      gateSaturatedMs: 1000,
      gatePendingMs: 1000,
      maxGatePendingObserved: 10,
    })
    expect(window.flush()).toBeUndefined()
  })

  it('reports zero-speed active periods but ignores idle periods', () => {
    const window = new DownloadPerformanceWindow()
    window.add({ bytes: 0, duration: 1000, speed: 0, active: 2, pending: 0, limit: 64 })
    expect(window.flush()).toMatchObject({ zeroSpeedActiveMs: 1000, networkActiveMs: 1000 })
    window.add({ bytes: 0, duration: 1000, speed: 0, active: 0, pending: 0, limit: 64 })
    expect(window.flush()).toBeUndefined()
  })
})