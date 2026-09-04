import { Dispatcher } from 'undici'
import { describe, expect, test, vi } from 'vitest'
import { ConcurrencyDispatcher } from './concurrency_dispatcher'

class ManualDispatcher extends Dispatcher {
  requests: Array<{ handler: Dispatcher.DispatchHandler }> = []
  closed = 0

  dispatch(_options: Dispatcher.DispatchOptions, handler: Dispatcher.DispatchHandler): boolean {
    this.requests.push({ handler })
    return true
  }

  complete(index: number) {
    this.requests[index].handler.onComplete?.(null)
  }

  fail(index: number, error: Error) {
    this.requests[index].handler.onError?.(error)
  }

  close(): Promise<void>
  close(callback: () => void): void
  close(callback?: () => void): void | Promise<void> {
    this.closed++
    if (callback) return callback()
    return Promise.resolve()
  }
}

describe('ConcurrencyDispatcher', () => {
  test('bounds global in-flight requests and drains in FIFO order', () => {
    const underlying = new ManualDispatcher()
    const dispatcher = new ConcurrencyDispatcher(underlying, () => 2)
    const completed = Array.from({ length: 5 }, () => vi.fn())
    const dispatched = Array.from({ length: 5 }, () => vi.fn())

    for (let index = 0; index < completed.length; index++) {
      dispatcher.dispatch({ origin: 'https://example.com', path: `/${index}`, method: 'GET' }, {
        onDispatch: dispatched[index],
        onComplete: completed[index],
        onError: vi.fn(),
      } as Dispatcher.DispatchHandler & { onDispatch: () => void })
    }

    expect(underlying.requests).toHaveLength(2)
    expect(dispatched.map((callback) => callback.mock.calls.length)).toEqual([1, 1, 0, 0, 0])
    expect(dispatcher.active).toBe(2)
    expect(dispatcher.pending).toBe(3)

    underlying.complete(0)
    expect(completed[0]).toHaveBeenCalledOnce()
    expect(underlying.requests).toHaveLength(3)
    expect(dispatched.map((callback) => callback.mock.calls.length)).toEqual([1, 1, 1, 0, 0])
    expect(dispatcher.active).toBe(2)
    expect(dispatcher.pending).toBe(2)

    underlying.complete(1)
    underlying.complete(2)
    expect(underlying.requests).toHaveLength(5)
    expect(dispatcher.active).toBe(2)
    expect(dispatcher.pending).toBe(0)
  })

  test('releases a permit when a request fails', () => {
    const underlying = new ManualDispatcher()
    const dispatcher = new ConcurrencyDispatcher(underlying, () => 1)
    const onError = vi.fn()

    dispatcher.dispatch({ origin: 'https://example.com', path: '/first', method: 'GET' }, {
      onComplete: vi.fn(),
      onError,
    })
    dispatcher.dispatch({ origin: 'https://example.org', path: '/second', method: 'GET' }, {
      onComplete: vi.fn(),
      onError: vi.fn(),
    })

    underlying.fail(0, new Error('failed'))

    expect(onError).toHaveBeenCalledOnce()
    expect(underlying.requests).toHaveLength(2)
    expect(dispatcher.active).toBe(1)
    expect(dispatcher.pending).toBe(0)
  })

  test('removes a queued request when it is aborted before dispatch', () => {
    const underlying = new ManualDispatcher()
    const dispatcher = new ConcurrencyDispatcher(underlying, () => 1)
    const abortController = new AbortController()
    const onError = vi.fn()

    dispatcher.dispatch({ origin: 'https://example.com', path: '/active', method: 'GET' }, {
      onComplete: vi.fn(),
      onError: vi.fn(),
    })
    dispatcher.dispatch({
      origin: 'https://example.com',
      path: '/queued',
      method: 'GET',
      signal: abortController.signal,
    } as Dispatcher.DispatchOptions, {
      onComplete: vi.fn(),
      onError,
    })

    const reason = new Error('cancelled while queued')
    abortController.abort(reason)

    expect(onError).toHaveBeenCalledWith(reason)
    expect(dispatcher.pending).toBe(0)
    underlying.complete(0)
    expect(underlying.requests).toHaveLength(1)
    expect(dispatcher.active).toBe(0)
    expect(dispatcher.telemetrySnapshot()).toMatchObject({
      requests: 2,
      queuedRequests: 1,
      queuedAborted: 1,
      maxActive: 1,
      maxPending: 1,
      minLimit: 1,
      maxLimit: 1,
    })
    expect(dispatcher.telemetrySnapshot()).toBeUndefined()
  })

  test('waits for active and queued requests before closing the underlying dispatcher', async () => {
    const underlying = new ManualDispatcher()
    const dispatcher = new ConcurrencyDispatcher(underlying, () => 1)

    for (let index = 0; index < 2; index++) {
      dispatcher.dispatch({ origin: 'https://example.com', path: `/${index}`, method: 'GET' }, {
        onComplete: vi.fn(),
        onError: vi.fn(),
      })
    }

    const closing = dispatcher.close()
    expect(underlying.closed).toBe(0)
    underlying.complete(0)
    expect(underlying.requests).toHaveLength(2)
    expect(underlying.closed).toBe(0)
    underlying.complete(1)
    await closing

    expect(underlying.closed).toBe(1)
    expect(dispatcher.active).toBe(0)
    expect(dispatcher.pending).toBe(0)
    expect(() => dispatcher.dispatch({
      origin: 'https://example.com',
      path: '/late',
      method: 'GET',
    }, {
      onComplete: vi.fn(),
      onError: vi.fn(),
    })).toThrow('Dispatcher is closed')
  })
})
