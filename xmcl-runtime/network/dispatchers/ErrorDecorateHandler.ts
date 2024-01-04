import { Dispatcher } from 'undici'
import { DispatchHandler } from './dispatcher'

export class ErrorDecorateHandler extends DispatchHandler {
  constructor(handler: Dispatcher.DispatchHandlers, private options: Dispatcher.DispatchOptions,
    private _onError: (err: Error) => void) {
    super(handler)
  }

  onError(err: Error): void {
    Object.assign(err, { options: this.options })
    this._onError(err)
    super.onError(err)
  }
}
