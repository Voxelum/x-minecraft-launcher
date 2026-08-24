import { Dispatcher, DecoratorHandler } from 'undici'

export class SpeedMonitor {
  aggregate = 0
  lastSample = Date.now()

  constructor() {}

  append(chunkSize: number) {
    this.aggregate += chunkSize
  }

  sample() {
    return this.drain().speed
  }

  drain() {
    const now = Date.now()
    const bytes = this.aggregate
    const duration = now - this.lastSample
    this.aggregate = 0
    this.lastSample = now
    return {
      bytes,
      duration,
      speed: duration > 0 ? bytes / (duration / 1000) : 0,
    }
  }
}

export class TrackSpeedHandler extends DecoratorHandler {
  constructor(
    handler: Dispatcher.DispatchHandler,
    readonly monitor: SpeedMonitor,
  ) {
    super(handler)
  }

  onResponseData(controller: Dispatcher.DispatchController, chunk: Buffer) {
    // @ts-ignore
    super.onResponseData(controller, chunk)
    this.monitor.append(chunk.length)
  }
}
