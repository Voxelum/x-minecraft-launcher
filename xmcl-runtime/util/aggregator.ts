import throttle from 'lodash.throttle'

export class AggregateExecutor<T, A = T> {
  private queue: T[] = []

  private commit: () => void

  constructor(
    private aggregator: Aggregator<T, A>,
    private _flush: (value: A) => void,
    timeout: number) {
    this.commit = throttle(() => {
      const aggregated = aggregator(this.queue)
      this.queue = []
      _flush(aggregated)
    }, timeout)
  }

  flush() {
    const aggregated = this.aggregator(this.queue)
    this.queue = []
    return this._flush(aggregated)
  }

  push(value: T) {
    this.queue.push(value)
    this.commit()
  }
}

export interface Aggregator<T, A = T> {
  (values: T[]): A
}

export interface WorkerRetryOptions {
  retryCount?: number
  shouldRetry?: (e: Error) => boolean
  retryAwait?: (retry: number) => number
}
/**
 * A job queue that has n workers to process the job.
 */
export class WorkerQueue<T> {
  private queue: { job: T; retry: number }[] = []
  private busy = 0
  private retryCount = 3
  private shouldRetry = (e: Error) => true
  private retryAwait = (retry: number) => 1000 * Math.pow(2, retry)

  constructor(
    private worker: (value: T) => Promise<void>,
    private workers: number,
    options: WorkerRetryOptions = {},
  ) {
    this.retryCount = options.retryCount || this.retryCount
    this.shouldRetry = options.shouldRetry || this.shouldRetry
    this.retryAwait = options.retryAwait || this.retryAwait
  }

  onerror = (job: T, e: Error) => {}

  async workIfIdle() {
    if (this.busy < this.workers && this.queue.length > 0) {
      this.busy++
      const { job, retry } = this.queue.shift()!
      try {
        await this.worker(job)
      } catch (e) {
        if (retry < this.retryCount && this.shouldRetry(e as Error)) {
          await new Promise((resolve) => setTimeout(resolve, this.retryAwait(retry)))
          this.queue.push({ job, retry: retry + 1 })
        } else {
          this.onerror(job, e as Error)
        }
      } finally {
        this.busy--
        this.workIfIdle()
      }
    }
  }

  push(value: T) {
    if (this.queue.some((j) => j.job === value)) {
      this.workIfIdle()
      return
    }
    this.queue.push({ job: value, retry: 0 })
    this.workIfIdle()
  }

  dispose() {
    this.queue = []
  }
}
