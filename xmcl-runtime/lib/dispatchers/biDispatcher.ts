import { Dispatcher } from 'undici'
import { DispatchHandler } from './dispatcher'

export const kUseDownload = Symbol('UseDownload')

class ErrorDecorateHandler extends DispatchHandler {
  constructor(handler: Dispatcher.DispatchHandlers, private options: Dispatcher.DispatchOptions) {
    super(handler)
  }

  onError(err: Error): void {
    Object.assign(err, { options: this.options })
    super.onError(err)
  }
}

/**
 * Control the e2e time, should not be exceed a value
 */
class TimeoutHandler extends DispatchHandler {
  private handle: ReturnType<(typeof setTimeout)>
  private abort = () => {}

  constructor(handler: Dispatcher.DispatchHandlers, private timeout: number) {
    super(handler)
    // this.handle = setTimeout(() => {
    //   this.abort()
    //   super.onError(new errors.HeadersTimeoutError(`End to end timeout exceed ${timeout}`, {}))
    // }, timeout)
  }

  onConnect(abort: () => void, context?: any): void {
    // this.abort = abort
    super.onConnect(abort, context)
  }

  onError(err: Error): void {
    // clearTimeout(this.handle)
    return super.onError(err)
  }

  onComplete(trailers: string[] | null): void {
    // clearTimeout(this.handle)
    return super.onComplete(trailers)
  }
}

export class BiDispatcher extends Dispatcher {
  constructor(private download: Dispatcher, private api: Dispatcher) {
    super()
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandlers): boolean {
    if ((options as any)[kUseDownload]) {
      return this.download.dispatch(options, new ErrorDecorateHandler(handler, options))
    } else {
      return this.api.dispatch(options, new ErrorDecorateHandler(handler, options))
    }
  }
}
