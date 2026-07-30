import { Dispatcher } from 'undici'
import { ProgressTracker, ProgressTrackerSingle } from './progress'
import { FileHandler } from './file_handler'
import { RangePolicy } from './range_policy'

export class RangeRequestHandler extends FileHandler {
  rangeInfo: ProgressTracker = {
    total: 0,
    progress: 0,
    url: '',
  }

  private childrenResolvers = Promise.withResolvers<void>()
  private children: FileHandler[] = []

  constructor(
    readonly options: Dispatcher.DispatchOptions & {
      signal?: AbortSignal
    },
    readonly dispatcher: Dispatcher,
    fd: number,
    readonly rangePolicy: RangePolicy,
    tracker?: ProgressTrackerSingle,
    destinationExtension?: string,
  ) {
    super(options.signal, fd, `${options.origin}${options.path}`, destinationExtension)
    // If the parent's response fails before `onHeaderParsed` runs
    // (e.g. HTTP 4xx/5xx, malformed headers, network error), we will
    // never spawn child range requests and the existing code paths
    // would leave `childrenResolvers` pending forever — leaking the
    // promise pair and preventing `tracker.done` from ever being set.
    // Folding children to "resolved" on parent rejection is safe: if
    // children were never spawned there is nothing to wait for, and
    // if they were spawned the inner `Promise.all` wiring will settle
    // them independently (subsequent calls on an already-settled
    // resolver are no-ops).
    this.resolvers.promise.catch(() => this.childrenResolvers.resolve())
    if (tracker) {
      tracker.setAccessor(this.rangeInfo)
      this.rangeInfo.url = options.origin + options.path
      Promise.allSettled([this.resolvers.promise, this.childrenResolvers.promise]).finally(() => {
        tracker.done = true
      })
    }
  }

  protected override onHeaderParsed(acceptRanges: boolean, total: number): void {
    const [origin, path] = [
      this.context?.history?.[0]?.origin ?? this.options.origin,
      this.context?.history?.[0]?.pathname ?? this.options.path,
    ]
    this.rangeInfo.total = total
    this.rangeInfo.url = origin + path

    if (!acceptRanges || total === this.contentLength) {
      this.childrenResolvers.resolve()
      return
    }

    const remainingStart = this.start + this.contentLength
    const remainingEnd = total - 1

    const ranges = this.rangePolicy.computeRangesInRange(remainingStart, remainingEnd)

    const childrenPromises: Promise<void>[] = []

    for (const range of ranges) {
      const handler = new FileHandler(this.options.signal, this.fd, `${origin}${path}`, this.destinationExtension)
      this.children.push(handler)
      handler.onWritten = this.onWritten
      childrenPromises.push(handler.wait())
      this.dispatcher.dispatch(
        {
          ...this.options,
          origin,
          path,
          headers: {
            ...this.options.headers,
            Range: `bytes=${range.start}-${range.end}`,
          },
        },
        handler,
      )
    }

    Promise.all(childrenPromises)
      .then(() => this.childrenResolvers.resolve())
      .catch((err) => this.childrenResolvers.reject(err))
  }

  onWritten = (bytesWritten: number) => {
    this.rangeInfo.progress =
      this.position - this.start + this.children.reduce((a, b) => a + b.position - b.start, 0)
  }

  override wait(): Promise<void> {
    return Promise.all([super.wait(), this.childrenResolvers.promise]).then(() => {})
  }
}
