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
  ) {
    super(options.signal, fd)
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
      const handler = new FileHandler(this.options.signal, this.fd)
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
