/**
 * Web platform gaps of WebKitGTK the launcher UI relies on.
 *
 * Measured against WebKitGTK 2.50.4 (Ubuntu) versus Chromium 133: the UI uses
 * `requestIdleCallback` for deferred work, and WebKit ships neither it nor
 * `cancelIdleCallback`.
 */

interface Deadline {
  didTimeout: boolean
  timeRemaining(): number
}

type IdleCallback = (deadline: Deadline) => void

const scope = globalThis as typeof globalThis & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout?: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

if (!scope.requestIdleCallback) {
  scope.requestIdleCallback = (callback, options) => {
    const start = performance.now()
    return setTimeout(() => {
      callback({
        didTimeout: false,
        // Mirrors the browser budget so callers keep chunking their work.
        timeRemaining: () => Math.max(0, 50 - (performance.now() - start)),
      })
    }, options?.timeout ?? 1) as unknown as number
  }
  scope.cancelIdleCallback = (handle) => clearTimeout(handle)
}
