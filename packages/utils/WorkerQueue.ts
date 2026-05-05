export interface WorkerRetryOptions<T> {
  retryCount?: number
  shouldRetry?: (e: Error) => boolean
  retryAwait?: (retry: number) => number
  isEqual?: (a: T, b: T) => boolean
  merge?: (a: T, b: T) => T
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
  private isEqual = (a: T, b: T) => a === b
  private merge?: (a: T, b: T) => T
  private disposed = false

  constructor(
    private worker: (value: T) => Promise<void>,
    public workers: number,
    options: WorkerRetryOptions<T> = {},
  ) {
    this.retryCount = options.retryCount || this.retryCount
    this.shouldRetry = options.shouldRetry || this.shouldRetry
    this.retryAwait = options.retryAwait || this.retryAwait
    this.isEqual = options.isEqual || this.isEqual
    this.merge = options.merge
  }

  onerror = (job: T, e: Error) => {}

  onIdle = () => {}

  async workIfIdle() {
    if (this.disposed) return
    if (this.queue.length === 0 && this.busy === 0) {
      this.onIdle()
      return
    }
    if (this.busy < this.workers && this.queue.length > 0) {
      this.busy++
      const { job, retry } = this.queue[0]
      try {
        await this.worker(job)
        if (this.disposed) return
        this.queue.shift()
      } catch (e) {
        if (this.disposed) return
        this.queue.shift()
        if (retry < this.retryCount && this.shouldRetry(e as Error)) {
          await new Promise((resolve) => setTimeout(resolve, this.retryAwait(retry)))
          if (this.disposed) return
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
    if (this.disposed) return
    if (this.merge) {
      const existed = this.queue.find((j) => this.isEqual(j.job, value))
      if (existed) {
        existed.job = this.merge(existed.job, value)
        this.workIfIdle()
        return
      }
    }
    this.queue.push({ job: value, retry: 0 })
    this.workIfIdle()
  }

  dispose() {
    this.disposed = true
    this.queue = []
  }
}
