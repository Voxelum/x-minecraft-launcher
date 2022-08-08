/* eslint-disable no-dupe-class-members */
import { Dispatcher, getGlobalDispatcher } from 'undici'

export interface RetryHandler {
  
}

export class RetryDispatcher extends Dispatcher {
  constructor(private handler: RetryHandler, readonly wrap: Dispatcher = getGlobalDispatcher()) {
    super()
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandlers): boolean {
    const wrappedHandler: Dispatcher.DispatchHandlers = {
      onConnect: handler.onConnect,
      onUpgrade: handler.onUpgrade,
      onHeaders: handler.onHeaders,
      onData: handler.onData,
      onComplete: handler.onComplete,
      onBodySent: handler.onBodySent,
      onError: (error) => {
        this.wrap.dispatch(options, wrappedHandler)
        return handler.onError?.(error)
      },
    }
    return this.wrap.dispatch(options, wrappedHandler)
  }

  close(): Promise<void>
  close(callback: () => void): void
  close(callback?: unknown): void | Promise<void> {
    // @ts-ignore
    return this.wrap.close(callback)
  }

  destroy(): Promise<void>
  destroy(err: Error | null): Promise<void>
  destroy(callback: () => void): void
  destroy(err: Error | null, callback: () => void): void
  destroy(err?: unknown, callback?: unknown): void | Promise<void> {
    // @ts-ignore
    return this.wrap.destroy(err, callback)
  }
}
