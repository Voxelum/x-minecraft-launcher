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
