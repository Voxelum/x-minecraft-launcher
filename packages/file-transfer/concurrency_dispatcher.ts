import { Dispatcher } from 'undici'

type DispatchHandler = Dispatcher.DispatchHandler

interface PendingDispatch {
  options: Dispatcher.DispatchOptions
  handler: DispatchHandler
  signal?: AbortSignal
  onAbort?: () => void
  enqueuedAt?: number
}

export interface ConcurrencyDispatcherTelemetry {
  requests: number
  queuedRequests: number
  queuedAborted: number
  maxActive: number
  maxPending: number
  queueWaitMs: number
  maxQueueWaitMs: number
  minLimit: number
  maxLimit: number
}

export class ConcurrencyDispatcher extends Dispatcher {
  #active = 0
  #queue: PendingDispatch[] = []
  #closing?: Promise<void>
  #closed = false
  #idleResolvers: Array<() => void> = []
  #telemetry = newTelemetry()

  constructor(
    readonly dispatcher: Dispatcher,
    private readonly getConcurrency: () => number,
  ) {
    super()
  }

  get active() {
    return this.#active
  }

  get pending() {
    return this.#queue.length
  }

  get limit() {
    return this.#concurrency
  }

  dispatch(options: Dispatcher.DispatchOptions, handler: DispatchHandler): boolean {
    if (this.#closed) throw new Error('Dispatcher is closed')
    const limit = this.#concurrency
    this.#telemetry.requests++
    this.#telemetry.minLimit = Math.min(this.#telemetry.minLimit, limit)
    this.#telemetry.maxLimit = Math.max(this.#telemetry.maxLimit, limit)
    const request = { options, handler }
    if (this.#active < limit) {
      this.#dispatch(request)
    } else {
      this.#enqueue(request)
    }
    return true
  }

  close(callback: () => void): void
  close(): Promise<void>
  close(callback?: () => void): void | Promise<void> {
    const closing = this.#close()
    if (callback) {
      closing.then(callback, callback)
      return
    }
    return closing
  }

  destroy(err: Error | null, callback: () => void): void
  destroy(callback: () => void): void
  destroy(err: Error | null): Promise<void>
  destroy(): Promise<void>
  destroy(errorOrCallback?: Error | null | (() => void), callback?: () => void): void | Promise<void> {
    if (typeof errorOrCallback === 'function') return this.dispatcher.destroy(errorOrCallback)
    if (callback) return this.dispatcher.destroy(errorOrCallback ?? null, callback)
    if (errorOrCallback) return this.dispatcher.destroy(errorOrCallback)
    return this.dispatcher.destroy()
  }

  get #concurrency() {
    return Math.max(1, Math.floor(this.getConcurrency()))
  }

  telemetrySnapshot(): ConcurrencyDispatcherTelemetry | undefined {
    const telemetry = this.#telemetry
    this.#telemetry = newTelemetry()
    if (telemetry.requests === 0) return undefined
    return {
      ...telemetry,
      minLimit: Number.isFinite(telemetry.minLimit) ? telemetry.minLimit : this.#concurrency,
    }
  }

  #enqueue(request: PendingDispatch) {
    this.#telemetry.queuedRequests++
    const signal = (request.options as Dispatcher.DispatchOptions & { signal?: AbortSignal }).signal
    request.signal = signal
    if (signal?.aborted) {
      request.handler.onError?.(this.#abortError(signal))
      return
    }
    if (signal) {
      request.onAbort = () => {
        const index = this.#queue.indexOf(request)
        if (index === -1) return
        this.#queue.splice(index, 1)
        this.#telemetry.queuedAborted++
        this.#removeAbortListener(request)
        request.handler.onError?.(this.#abortError(signal))
        this.#resolveIdle()
      }
      signal.addEventListener('abort', request.onAbort, { once: true })
    }
    request.enqueuedAt = Date.now()
    this.#queue.push(request)
    this.#telemetry.maxPending = Math.max(this.#telemetry.maxPending, this.#queue.length)
  }

  #dispatch(request: PendingDispatch) {
    this.#removeAbortListener(request)
    if (request.enqueuedAt !== undefined) {
      const queueWaitMs = Date.now() - request.enqueuedAt
      this.#telemetry.queueWaitMs += queueWaitMs
      this.#telemetry.maxQueueWaitMs = Math.max(this.#telemetry.maxQueueWaitMs, queueWaitMs)
    }
    this.#active += 1
    this.#telemetry.maxActive = Math.max(this.#telemetry.maxActive, this.#active)
    ;(request.handler as DispatchHandler & { onDispatch?: () => void }).onDispatch?.()
    let released = false
    const release = () => {
      if (released) return
      released = true
      this.#active -= 1
      this.#drain()
      this.#resolveIdle()
    }
    const handler = new Proxy(request.handler, {
      get(target, property) {
        const value = Reflect.get(target, property, target)
        if (typeof value !== 'function') return value
        if (
          property === 'onComplete' ||
          property === 'onError' ||
          property === 'onUpgrade' ||
          property === 'onResponseEnd' ||
          property === 'onResponseError' ||
          property === 'onRequestUpgrade'
        ) {
          return (...args: unknown[]) => {
            try {
              return value.apply(target, args)
            } finally {
              release()
            }
          }
        }
        return value.bind(target)
      },
    })
    try {
      this.dispatcher.dispatch(request.options, handler)
    } catch (error) {
      release()
      throw error
    }
  }

  #drain() {
    while (this.#active < this.#concurrency && this.#queue.length > 0) {
      this.#dispatch(this.#queue.shift()!)
    }
  }

  #removeAbortListener(request: PendingDispatch) {
    if (request.signal && request.onAbort) {
      request.signal.removeEventListener('abort', request.onAbort)
      request.onAbort = undefined
    }
  }

  #abortError(signal: AbortSignal) {
    return signal.reason instanceof Error ? signal.reason : new Error('The operation was aborted')
  }

  #close() {
    if (!this.#closing) {
      this.#closed = true
      this.#closing = this.#waitForIdle().then(() => this.dispatcher.close())
    }
    return this.#closing
  }

  #waitForIdle() {
    if (this.#active === 0 && this.#queue.length === 0) return Promise.resolve()
    return new Promise<void>((resolve) => this.#idleResolvers.push(resolve))
  }

  #resolveIdle() {
    if (this.#active !== 0 || this.#queue.length !== 0) return
    for (const resolve of this.#idleResolvers.splice(0)) resolve()
  }
}

function newTelemetry(): ConcurrencyDispatcherTelemetry {
  return {
    requests: 0,
    queuedRequests: 0,
    queuedAborted: 0,
    maxActive: 0,
    maxPending: 0,
    queueWaitMs: 0,
    maxQueueWaitMs: 0,
    minLimit: Number.POSITIVE_INFINITY,
    maxLimit: 0,
  }
}
