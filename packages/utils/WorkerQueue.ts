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
      // Claim the job by removing it from the queue BEFORE awaiting the
      // worker. If we only shifted after the await (as before), every
      // concurrent `workIfIdle` invocation triggered by a synchronous
      // burst of `push()` calls would read the SAME `queue[0]` and run
      // it `workers` times in parallel (verified: a 300-job burst with
      // 128 workers ran the head job 128×). For the unzip step that
      // meant the first override file was extracted by 128 racing
      // writers onto one destination.
      const { job, retry } = this.queue.shift()!
      try {
        await this.worker(job)
      } catch (e) {
        if (this.disposed) return
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
