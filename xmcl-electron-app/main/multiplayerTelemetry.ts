import type { MultiplayerTelemetryEvent } from '@xmcl/runtime-api'

interface MultiplayerTelemetryReporterOptions {
  baseUrl: string
  deviceId: string
  launcherSessionId: string
  getAccountId(): string | undefined
  launcherVersion: string
  launcherBuild: string
  isEnabled(): boolean
  fetch(url: string, init: RequestInit): Promise<Response>
  warn(message: string): void
}

export interface MultiplayerTelemetryReporter {
  beginAttempt(): ((event: MultiplayerTelemetryEvent) => void) | undefined
  dispose(): Promise<void>
}

export function createMultiplayerTelemetryReporter(
  options: MultiplayerTelemetryReporterOptions,
): MultiplayerTelemetryReporter {
  type AttemptPayload = MultiplayerTelemetryEvent & {
    schemaVersion: 1
    occurredAt: string
    source: 'launcher'
    deviceId: string
    launcherSessionId: string
    launcherVersion: string
    launcherBuild: string
  }
  const queue: Array<{
    expectedAccountId: string
    attempt: AttemptPayload
  }> = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let flushing: Promise<void> | undefined
  let activeController: AbortController | undefined
  let disposed = false

  const schedule = (delay = 1_000) => {
    if (disposed || timer) return
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, delay)
  }

  const flush = () => {
    if (flushing) return flushing
    if (queue.length === 0) return Promise.resolve()
    if (!options.isEnabled()) {
      queue.length = 0
      return Promise.resolve()
    }
    const expectedAccountId = queue[0].expectedAccountId
    const batch: typeof queue = []
    for (let i = 0; i < queue.length && batch.length < 50;) {
      if (queue[i].expectedAccountId === expectedAccountId) {
        batch.push(...queue.splice(i, 1))
      } else {
        i++
      }
    }
    const controller = new AbortController()
    activeController = controller
    const requestTimeout = setTimeout(
      () => controller.abort(),
      disposed ? 2_000 : 10_000,
    )
    const operation = options.fetch(
      new URL('/v1/multiplayer/telemetry/attempts', options.baseUrl).toString(),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({
          expectedAccountId,
          attempts: batch.map(({ attempt }) => attempt),
        }),
      },
    ).then((response) => {
      if (response.ok) return
      if ((response.status === 429 || response.status >= 500) && !disposed) {
        queue.unshift(...batch)
        while (queue.length > 200) queue.shift()
        schedule(10_000)
      } else {
        options.warn(`P2P telemetry batch rejected with status ${response.status}`)
      }
    }).catch(() => {
      queue.unshift(...batch)
      while (queue.length > 200) queue.shift()
      if (!disposed) schedule(10_000)
    }).finally(() => {
      clearTimeout(requestTimeout)
      if (activeController === controller) activeController = undefined
      flushing = undefined
      if (queue.length > 0) schedule()
    })
    flushing = operation
    return operation
  }

  return {
    beginAttempt() {
      if (disposed || !options.isEnabled()) return
      const expectedAccountId = options.getAccountId()
      if (!expectedAccountId) return
      return (event) => {
        if (disposed || !options.isEnabled()) return
        queue.push({
          expectedAccountId,
          attempt: {
            schemaVersion: 1,
            occurredAt: new Date().toISOString(),
            source: 'launcher',
            deviceId: options.deviceId,
            launcherSessionId: options.launcherSessionId,
            launcherVersion: options.launcherVersion,
            launcherBuild: options.launcherBuild,
            ...event,
          },
        })
        while (queue.length > 200) queue.shift()
        if (queue.length >= 50) void flush()
        else schedule()
      }
    },
    async dispose() {
      disposed = true
      if (timer) clearTimeout(timer)
      timer = undefined
      activeController?.abort()
      await flushing
      while (queue.length > 0) {
        const queued = queue.length
        await flush()
        if (queue.length >= queued) break
      }
      queue.length = 0
    },
  }
}
