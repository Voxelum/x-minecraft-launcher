/* eslint-disable no-dupe-class-members */
import { Duplex } from 'stream'
import { Dispatcher, getGlobalDispatcher } from 'undici'

export interface DispatchInterceptor {
  (options: Dispatcher.DispatchOptions): void
}

export class DispatchHandler implements Dispatcher.DispatchHandler {
  constructor(protected handler: Dispatcher.DispatchHandler) {
  }

  /** Invoked before request is dispatched on socket. May be invoked multiple times when a request is retried when the request at the head of the pipeline fails. */
  onConnect(abort: () => void, context?: object): void {
    (this.handler.onConnect as any)?.(abort, context)
  }

  /** Invoked when an error has occurred. */
  onError(err: Error): void {
    this.handler.onError?.(err)
  }

  /** Invoked when request is upgraded either due to a `Upgrade` header or `CONNECT` method. */
  onUpgrade(statusCode: number, headers: string[] | null, socket: Duplex): void {
    this.handler.onUpgrade?.(statusCode, headers, socket)
  }

  /** Invoked when statusCode and headers have been received. May be invoked multiple times due to 1xx informational headers. */
  onHeaders(statusCode: number, headers: Buffer[] | string[] | null, resume: () => void, statusMessage?: any): boolean {
    return this.handler.onHeaders?.(statusCode, headers as any, resume, statusMessage) ?? false
  }

  /** Invoked when response payload data is received. */
  onData(chunk: Buffer): boolean {
    return this.handler.onData?.(chunk) ?? false
  }

  /** Invoked when response payload and trailers have been received and the request has completed. */
  onComplete(trailers: string[] | null): void {
    this.handler.onComplete?.(trailers)
  }

  onBodySent(chunkSize: number, totalBytesSent: number) {
    this.handler.onBodySent?.(chunkSize, totalBytesSent)
  }
}

export function createInterceptOptionsInterceptor(interceptors: DispatchInterceptor[]): Dispatcher.DispatchInterceptor {
  return (dispatch) => {
    return function Intercept(options, handler) {
      for (const interceptor of interceptors) {
        interceptor(options)
      }
      return dispatch(options, handler)
    }
  }
}

export class InteroperableDispatcher extends Dispatcher {
  constructor(private interceptors: DispatchInterceptor[], readonly dispatcher: Dispatcher = getGlobalDispatcher()) {
    super()
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler): boolean {
    const process = async () => {
      for (const interceptor of this.interceptors) {
        await interceptor(options)
      }
      this.dispatcher.dispatch(options, handler)
    }
    process()
    return true
  }

  destroy(): Promise<void>
  destroy(err: Error | null): Promise<void>
  destroy(callback: () => void): void
  destroy(err: Error | null, callback: () => void): void
  destroy(err?: unknown, callback?: unknown): void | Promise<void> {
    return this.dispatcher.destroy(err as any, callback as any)
  }

  close(): Promise<void>
  close(callback: () => void): void
  close(callback?: unknown): void | Promise<void> {
    return this.dispatcher.close(callback as any)
  }
}
