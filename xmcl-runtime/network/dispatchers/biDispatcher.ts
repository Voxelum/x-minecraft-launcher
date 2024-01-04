import { Dispatcher } from 'undici'
import { ErrorDecorateHandler } from './ErrorDecorateHandler'

export const kUseDownload = Symbol('UseDownload')

export class BiDispatcher extends Dispatcher {
  constructor(private download: Dispatcher, private api: Dispatcher, private onError: (err: Error) => void) {
    super()
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandlers): boolean {
    if ((options as any)[kUseDownload]) {
      return this.download.dispatch(options, new ErrorDecorateHandler(handler, options, this.onError))
    } else {
      return this.api.dispatch(options, new ErrorDecorateHandler(handler, options, this.onError))
    }
  }
}
