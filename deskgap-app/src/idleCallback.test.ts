import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installIdleCallbackShim } from './idleCallback'

function createHost(now = () => performance.now()) {
  return {
    setTimeout: (callback: () => void, delay?: number) => setTimeout(callback, delay) as unknown as number,
    clearTimeout: (handle?: number) => clearTimeout(handle),
    performance: { now } as Performance,
  } as Pick<Window, 'setTimeout' | 'clearTimeout' | 'performance'> & Partial<Pick<Window, 'requestIdleCallback' | 'cancelIdleCallback'>>
}

describe('DeskGap idle callback compatibility shim', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] }))
  afterEach(() => vi.useRealTimers())

  it('runs asynchronously once with a decreasing, nonnegative 5ms budget', () => {
    const host = createHost()
    installIdleCallbackShim(host)
    const callback = vi.fn((deadline: IdleDeadline) => {
      expect(deadline.didTimeout).toBe(false)
      expect(deadline.timeRemaining()).toBe(5)
      vi.advanceTimersByTime(3)
      expect(deadline.timeRemaining()).toBe(2)
      vi.advanceTimersByTime(10)
      expect(deadline.timeRemaining()).toBe(0)
    })
    host.requestIdleCallback!(callback)
    expect(callback).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('cancels only the requested callback and ignores unknown handles', () => {
    const host = createHost()
    installIdleCallbackShim(host)
    const cancelled = vi.fn()
    const kept = vi.fn()
    const handle = host.requestIdleCallback!(cancelled, { timeout: 0 })
    host.requestIdleCallback!(kept)
    host.cancelIdleCallback!(handle)
    host.cancelIdleCallback!(handle)
    host.cancelIdleCallback!(999999)
    vi.runAllTimers()
    expect(cancelled).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledTimes(1)
  })

  it('preserves a complete native pair and is idempotent', () => {
    const host = createHost()
    const request = host.requestIdleCallback = vi.fn()
    const cancel = host.cancelIdleCallback = vi.fn()
    installIdleCallbackShim(host)
    expect(host.requestIdleCallback).toBe(request)
    expect(host.cancelIdleCallback).toBe(cancel)
    delete host.cancelIdleCallback
    installIdleCallbackShim(host)
    expect(host.requestIdleCallback).not.toBe(request)
    const shim = host.requestIdleCallback
    installIdleCallbackShim(host)
    expect(host.requestIdleCallback).toBe(shim)
  })

  it.each([0, 1, 10])('reports elapsed timeout %d with zero budget', (timeout) => {
    let clock = 0
    const host = createHost(() => clock)
    installIdleCallbackShim(host)
    const callback = vi.fn((deadline: IdleDeadline) => {
      expect(deadline.didTimeout).toBe(true)
      expect(deadline.timeRemaining()).toBe(0)
    })
    host.requestIdleCallback!(callback, { timeout })
    clock = timeout + 1 // Simulate a busy event loop delaying the timer.
    vi.runAllTimers()
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('does not wait for a future timeout or count queue delay against its synthetic budget', () => {
    let clock = 0
    const host = createHost(() => clock)
    installIdleCallbackShim(host)
    const callback = vi.fn((deadline: IdleDeadline) => {
      expect(deadline.didTimeout).toBe(false)
      expect(deadline.timeRemaining()).toBe(5)
    })
    host.requestIdleCallback!(callback, { timeout: 100 })
    clock = 80
    vi.advanceTimersByTime(1)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})
