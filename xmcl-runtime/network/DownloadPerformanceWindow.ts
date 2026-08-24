export interface DownloadPerformanceSample {
  bytes: number
  duration: number
  speed: number
  active: number
  pending: number
  limit: number
}

export class DownloadPerformanceWindow {
  private samples: DownloadPerformanceSample[] = []

  add(sample: DownloadPerformanceSample) {
    this.samples.push(sample)
  }

  flush(): Record<string, number> | undefined {
    const samples = this.samples
    this.samples = []
    if (samples.length === 0) return undefined
    const active = samples.filter((sample) => sample.active > 0 || sample.pending > 0 || sample.bytes > 0)
    if (active.length === 0) return undefined
    const speeds = active.map((sample) => sample.speed).sort((a, b) => a - b)
    const percentile = (value: number) => speeds[Math.min(speeds.length - 1, Math.max(0, Math.ceil(speeds.length * value) - 1))] ?? 0
    const duration = active.reduce((total, sample) => total + sample.duration, 0)
    const bytes = active.reduce((total, sample) => total + sample.bytes, 0)
    const below = (speed: number) => active.reduce((total, sample) => total + (sample.speed < speed ? sample.duration : 0), 0)
    return {
      aggregateBodyBytes: bytes,
      networkActiveMs: duration,
      meanAggregateSpeedBps: duration > 0 ? bytes / (duration / 1000) : 0,
      p10AggregateSpeedBps: percentile(0.1),
      p50AggregateSpeedBps: percentile(0.5),
      p90AggregateSpeedBps: percentile(0.9),
      below1MiBpsMs: below(1024 * 1024),
      below2MiBpsMs: below(2 * 1024 * 1024),
      zeroSpeedActiveMs: below(1),
      gateSaturatedMs: active.reduce((total, sample) => total + (sample.active >= sample.limit ? sample.duration : 0), 0),
      gatePendingMs: active.reduce((total, sample) => total + (sample.pending > 0 ? sample.duration : 0), 0),
      maxGateActive: Math.max(...active.map((sample) => sample.active)),
      maxGatePendingObserved: Math.max(...active.map((sample) => sample.pending)),
    }
  }
}