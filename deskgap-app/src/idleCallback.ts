type IdleCallbackHost = Pick<Window, 'setTimeout' | 'clearTimeout' | 'performance'> & Partial<Pick<Window, 'requestIdleCallback' | 'cancelIdleCallback'>>

/**
 * Timer-based compatibility shim, NOT a browser idle scheduler.
 * Uses the small setTimeout/deadline approach described by Paul Lewis:
 * https://developer.chrome.com/blog/using-requestidlecallback
 * https://gist.github.com/paullewis/55efe5d6f05434a96c36
 * Independently implemented with timeout reporting and a conservative 5ms budget.
 */
export function installIdleCallbackShim(host: IdleCallbackHost): void {
  if (typeof host.requestIdleCallback === 'function' && typeof host.cancelIdleCallback === 'function') return

  // A partial native pair cannot cancel our timer handles (or vice versa).
  // Install a coherent pair before renderer code can schedule any callbacks.
  const now = () => host.performance.now()
  host.requestIdleCallback = (callback, options) => {
    if (typeof callback !== 'function') throw new TypeError('Idle callback must be a function')
    const requested = now()
    const timeout = options?.timeout
    const hasTimeout = typeof timeout === 'number' && Number.isFinite(timeout) && timeout >= 0
    return host.setTimeout(() => {
      const started = now()
      const didTimeout = hasTimeout && started - requested >= timeout
      callback({
        didTimeout,
        timeRemaining: () => didTimeout ? 0 : Math.max(0, 5 - (now() - started)),
      })
    }, 1)
  }
  host.cancelIdleCallback = handle => host.clearTimeout(handle)
}
