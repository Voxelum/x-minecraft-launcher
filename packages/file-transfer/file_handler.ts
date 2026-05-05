import { write } from 'fs'
import { Dispatcher, util } from 'undici'

export class FileHandler implements Dispatcher.DispatchHandler {
  private abort?: (err?: Error) => void

  protected context?: {
    history?: URL[]
  }
  start = 0
  position: number = 0
  contentLength: number = 0
  protected signal: AbortSignal | undefined
  protected resolvers = Promise.withResolvers<void>()
  protected terminated = false
  protected pending = 0
  protected writeError?: Error
  protected listener = () => this.resolvers.reject(this.signal?.reason)

  constructor(
    signal: AbortSignal | undefined,
    readonly fd: number,
  ) {
    this.signal = signal
    this.resolvers.promise
      .catch((e) => {
        this.abort?.(e)
      })
      .finally(() => {
        this.signal?.removeEventListener('abort', this.listener)
      })
    this.signal?.addEventListener('abort', this.listener)
  }

  onConnect(...args: any[]): void {
    const [abort, context] = args
    this.context = context
    if (this.signal?.reason) {
      abort(this.signal?.reason)
      return
    }

    this.abort = abort
  }

  onHeaders(
    statusCode: number,
    rawHeaders: Buffer[],
    resume: () => void,
    statusText: string,
  ): boolean {
    const headers = util.parseHeaders(rawHeaders) as Record<string, string>

    if (statusCode < 200) {
      return false
    }

    if (statusCode >= 400) {
      this.resolvers.reject(new Error(`HTTP Error: ${statusCode} ${statusText}`))
      return false
    }

    // Check if server supports range requests
    // 206 Partial Content indicates range request was accepted
    // Accept-Ranges: bytes header indicates server supports range requests
    const acceptRanges = headers['accept-ranges']
    const contentRange = headers['content-range']
    const contentLength = headers['content-length']

    let acceptRangesFlag = false
    let total = 0

    if (statusCode === 206) {
      // Server returned partial content, it supports range requests
      acceptRangesFlag = true
      const match = contentRange.match(/bytes\s+(\d+)-(\d+)\/(\d+|\*)/)
      if (match) {
        this.position = parseInt(match[1], 10)
        this.contentLength = parseInt(match[2], 10) - this.position + 1

        if (match[3] !== '*') {
          total = parseInt(match[3], 10)
        }
      }
    } else if (statusCode === 200) {
      // Full content returned
      if (acceptRanges && acceptRanges.toLowerCase() === 'bytes') {
        acceptRangesFlag = true
      }
      if (contentLength) {
        this.contentLength = parseInt(contentLength, 10)
        total = this.contentLength
      }
    }

    this.start = this.position

    this.onHeaderParsed(acceptRangesFlag, total)

    resume()

    return true
  }

  protected onHeaderParsed(acceptRanges: boolean, total: number) {}

  private checkTermination() {
    if (this.pending === 0) {
      if (this.writeError) {
        this.resolvers.reject(this.writeError)
      } else {
        this.resolvers.resolve()
      }
    }
  }

  onData(chunk: Buffer): boolean {
    if (this.writeError) {
      return false
    }

    this.pending++

    write(this.fd, chunk, 0, chunk.length, this.position, (err, written) => {
      this.pending--

      if (err) {
        Error.captureStackTrace(err)
        this.writeError = err
        this.resolvers.reject(err)
        return
      }

      this.onWritten?.(written)

      if (this.terminated) {
        this.checkTermination()
      }
    })

    this.position += chunk.length
    return true
  }

  onWritten?(bytesWritten: number): void

  onComplete(trailers: string[] | null): void {
    this.terminated = true
    this.checkTermination()
  }

  onError(err: Error): void {
    this.terminated = true
    this.resolvers.reject(err)
  }

  wait(): Promise<void> {
    return this.resolvers.promise
  }
}
