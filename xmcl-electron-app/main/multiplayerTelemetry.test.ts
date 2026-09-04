import type { MultiplayerTelemetryEvent } from '@xmcl/runtime-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMultiplayerTelemetryReporter } from './multiplayerTelemetry'

const event: MultiplayerTelemetryEvent = {
  attemptId: '89d9a834-053c-42c5-a95e-87f2ed5c36f2',
  roomSessionId: '73fb5ca7-b8ec-4524-a115-9413d3b55ef9',
  turnSessionId: 'f9dd11a0-7143-48e0-a202-9fa32968bd74',
  kind: 'peer_connection',
  mode: 'official_room',
  role: 'member',
  outcome: 'succeeded',
  route: 'relay',
  localCandidateType: 'relay',
  remoteCandidateType: 'srflx',
  networkProtocol: 'udp',
  retry: 1,
  durationMs: 123,
}

describe('multiplayer telemetry reporter', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('batches privacy-safe events with launcher identity context', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(null, { status: 202 }))
    const reporter = createMultiplayerTelemetryReporter({
      baseUrl: 'https://multiplayer.test',
      deviceId: '7f9e9790-fce0-4215-bd65-241b12e45067',
      launcherSessionId: 'dd01bd81-0bbc-45db-8f1e-700dd4e3fb8f',
      getAccountId: () => 'acct_test',
      launcherVersion: '0.67.2',
      launcherBuild: '1469',
      isEnabled: () => true,
      fetch,
      warn: vi.fn(),
    })

    reporter.beginAttempt()!(event)
    reporter.beginAttempt()!({
      ...event,
      attemptId: 'dd5d1531-0c3d-49a7-a2ef-d433209b0f83',
    })
    await reporter.dispose()

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0][0]).toBe(
      'https://multiplayer.test/v1/multiplayer/telemetry/attempts',
    )
    const request = fetch.mock.calls[0][1]
    const body = JSON.parse(String(request.body))
    expect(body.expectedAccountId).toBe('acct_test')
    expect(body.attempts).toHaveLength(2)
    expect(body.attempts[0]).toMatchObject({
      schemaVersion: 1,
      source: 'launcher',
      deviceId: '7f9e9790-fce0-4215-bd65-241b12e45067',
      launcherSessionId: 'dd01bd81-0bbc-45db-8f1e-700dd4e3fb8f',
      launcherVersion: '0.67.2',
      launcherBuild: '1469',
      ...event,
    })
    expect(body.attempts[0]).not.toHaveProperty('accountId')
    expect(Date.parse(body.attempts[0].occurredAt)).not.toBeNaN()
  })

  it('drops queued events when telemetry is disabled', async () => {
    let enabled = true
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(null, { status: 202 }))
    const reporter = createMultiplayerTelemetryReporter({
      baseUrl: 'https://multiplayer.test',
      deviceId: '7f9e9790-fce0-4215-bd65-241b12e45067',
      launcherSessionId: 'dd01bd81-0bbc-45db-8f1e-700dd4e3fb8f',
      getAccountId: () => 'acct_test',
      launcherVersion: '0.67.2',
      launcherBuild: '1469',
      isEnabled: () => enabled,
      fetch,
      warn: vi.fn(),
    })

    const finish = reporter.beginAttempt()!
    enabled = false
    finish(event)
    await reporter.dispose()

    expect(fetch).not.toHaveBeenCalled()
  })

  it('flushes every queued attempt in batches of at most 50', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(null, { status: 202 }))
    const reporter = createMultiplayerTelemetryReporter({
      baseUrl: 'https://multiplayer.test',
      deviceId: '7f9e9790-fce0-4215-bd65-241b12e45067',
      launcherSessionId: 'dd01bd81-0bbc-45db-8f1e-700dd4e3fb8f',
      getAccountId: () => 'acct_test',
      launcherVersion: '0.67.2',
      launcherBuild: '1469',
      isEnabled: () => true,
      fetch,
      warn: vi.fn(),
    })

    for (let i = 0; i < 51; i++) {
      reporter.beginAttempt()!({ ...event, attemptId: crypto.randomUUID() })
    }
    await reporter.dispose()

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(JSON.parse(String(fetch.mock.calls[0][1].body)).attempts).toHaveLength(50)
    expect(JSON.parse(String(fetch.mock.calls[1][1].body)).attempts).toHaveLength(1)
  })

  it('does not mix attempts captured under different accounts', async () => {
    let accountId = 'acct_first'
    const fetch = vi.fn(async (_url: string, _init: RequestInit) =>
      new Response(null, { status: 202 }))
    const reporter = createMultiplayerTelemetryReporter({
      baseUrl: 'https://multiplayer.test',
      deviceId: '7f9e9790-fce0-4215-bd65-241b12e45067',
      launcherSessionId: 'dd01bd81-0bbc-45db-8f1e-700dd4e3fb8f',
      getAccountId: () => accountId,
      launcherVersion: '0.67.2',
      launcherBuild: '1469',
      isEnabled: () => true,
      fetch,
      warn: vi.fn(),
    })

    const finishFirst = reporter.beginAttempt()!
    accountId = 'acct_second'
    finishFirst(event)
    reporter.beginAttempt()!({
      ...event,
      attemptId: 'dd5d1531-0c3d-49a7-a2ef-d433209b0f83',
    })
    await reporter.dispose()

    expect(fetch).toHaveBeenCalledTimes(2)
    const first = JSON.parse(String(fetch.mock.calls[0][1].body))
    const second = JSON.parse(String(fetch.mock.calls[1][1].body))
    expect(first.expectedAccountId).toBe('acct_first')
    expect(first.attempts).toHaveLength(1)
    expect(second.expectedAccountId).toBe('acct_second')
    expect(second.attempts).toHaveLength(1)
  })

  it('bounds the shutdown flush when the server does not respond', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      }))
    const reporter = createMultiplayerTelemetryReporter({
      baseUrl: 'https://multiplayer.test',
      deviceId: '7f9e9790-fce0-4215-bd65-241b12e45067',
      launcherSessionId: 'dd01bd81-0bbc-45db-8f1e-700dd4e3fb8f',
      getAccountId: () => 'acct_test',
      launcherVersion: '0.67.2',
      launcherBuild: '1469',
      isEnabled: () => true,
      fetch,
      warn: vi.fn(),
    })

    reporter.beginAttempt()!(event)
    const disposing = reporter.dispose()
    await vi.advanceTimersByTimeAsync(2_000)

    await expect(disposing).resolves.toBeUndefined()
    expect(fetch.mock.calls[0][1].signal?.aborted).toBe(true)
  })

  it('retries an in-flight batch once during bounded shutdown', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      if (fetch.mock.calls.length > 1) {
        return Promise.resolve(new Response(null, { status: 202 }))
      }
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'))
        })
      })
    })
    const reporter = createMultiplayerTelemetryReporter({
      baseUrl: 'https://multiplayer.test',
      deviceId: '7f9e9790-fce0-4215-bd65-241b12e45067',
      launcherSessionId: 'dd01bd81-0bbc-45db-8f1e-700dd4e3fb8f',
      getAccountId: () => 'acct_test',
      launcherVersion: '0.67.2',
      launcherBuild: '1469',
      isEnabled: () => true,
      fetch,
      warn: vi.fn(),
    })

    reporter.beginAttempt()!(event)
    await vi.advanceTimersByTimeAsync(1_000)
    const disposing = reporter.dispose()
    await disposing

    expect(fetch).toHaveBeenCalledTimes(2)
    const first = JSON.parse(String(fetch.mock.calls[0][1].body))
    const retried = JSON.parse(String(fetch.mock.calls[1][1].body))
    expect(retried.attempts[0]).toEqual(first.attempts[0])
  })
})
