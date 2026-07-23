import { describe, expect, test, vi } from 'vitest'
import duplicateFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/duplicate.json'
import errorFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/error.json'
import retryFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/retry.json'
import idempotentRetryFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/idempotent-retry.json'
import insufficientBalanceFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/insufficient-balance.json'
import outOfOrderFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/out-of-order.json'
import permissionFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/permission.json'
import providerFailureFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/provider-failure.json'
import stateConflictFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/state-conflict.json'
import successFixture from '../../docs/commercialization/m8-ai-service/proposals/v1/fixtures/success.json'
import { AiApiClient, AiClientError, type AiFetch } from './AiApiClient'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function client(fetch: AiFetch, token: string | undefined = 'xmcl-session-fixture') {
  let requestId = 0
  return new AiApiClient({
    baseUrl: 'https://api.xmcl.test/',
    fetch,
    getAccessToken: async () => token,
    createRequestId: () => `client-request-${++requestId}`,
  })
}

describe('AiApiClient', () => {
  test('sends the XMCL session and reuses one idempotency key for an intent retry', async () => {
    const fetch = vi.fn<AiFetch>(async () => json({
      requestId: successFixture.request.requestId,
      ...successFixture.providerResult,
    }))
    const api = client(fetch)
    const intent = {
      capability: successFixture.request.capability,
      input: 'Local test input that is never retained in a fixture.',
      idempotencyKey: idempotentRetryFixture.attempts[0].idempotencyKey,
    }

    const first = await api.request(intent)
    const second = await api.request(intent)

    expect(first).toEqual(second)
    expect(fetch).toHaveBeenCalledTimes(2)
    for (const [url, init] of fetch.mock.calls) {
      expect(url).toBe('https://api.xmcl.test/v1/ai/troubleshoot')
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer xmcl-session-fixture')
      expect(new Headers(init?.headers).get('Idempotency-Key')).toBe('ai-intent-retry')
      expect(JSON.parse(String(init?.body))).toEqual({
        input: 'Local test input that is never retained in a fixture.',
      })
      expect(String(init?.body)).not.toContain('provider')
      expect(String(init?.body)).not.toContain('accountId')
    }
  })

  test('rejects invalid input and a missing M1 session before network access', async () => {
    const fetch = vi.fn<AiFetch>()
    const api = client(fetch)

    await expect(api.request({
      capability: errorFixture.request.capability,
      input: 'fixture',
      idempotencyKey: errorFixture.request.idempotencyKey,
    })).rejects.toMatchObject({
      code: errorFixture.expected.error,
      status: errorFixture.expected.status,
    })

    await expect(client(fetch, '').getModels()).rejects.toMatchObject({
      code: 'ai_unauthenticated',
      status: 401,
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  test.each([
    [permissionFixture.expected.status, permissionFixture.expected.error],
    [insufficientBalanceFixture.expected.status, insufficientBalanceFixture.expected.error],
    [stateConflictFixture.expected.status, stateConflictFixture.expected.error],
  ])('surfaces stable authorization error %s/%s', async (status, code) => {
    const fetch: AiFetch = async () => json({
      error: code,
      message: `Safe ${code} message.`,
      requestId: `server-${code}`,
    }, status)

    await expect(client(fetch).request({
      capability: 'troubleshoot',
      input: 'fixture',
      idempotencyKey: `intent-${code}`,
    })).rejects.toMatchObject({
      code,
      status,
      requestId: `server-${code}`,
    })
  })

  test('sanitizes provider failures and ignores provider details', async () => {
    const fetch: AiFetch = async () => json({
      error: providerFailureFixture.expected.error,
      message: 'Upstream said credential=provider-secret',
      requestId: 'server-provider-failure',
      details: { rawProviderBody: 'credential=provider-secret' },
    }, providerFailureFixture.expected.status)

    const error = await client(fetch).request({
      capability: providerFailureFixture.request.capability,
      input: 'fixture',
      idempotencyKey: providerFailureFixture.request.idempotencyKey,
    }).catch(e => e)

    expect(error).toBeInstanceOf(AiClientError)
    expect(error).toMatchObject({
      code: providerFailureFixture.expected.error,
      retryable: true,
    })
    expect(error.message).toBe('The AI provider is temporarily unavailable.')
    expect(error.message).not.toContain('provider-secret')
  })

  test('consumes server-deduplicated usage without imposing event order or publishing events', async () => {
    expect(new Set(retryFixture.attempts.map(e => e.eventId)).size).toBe(1)
    expect(new Set(retryFixture.attempts.map(e => e.idempotencyKey)).size).toBe(1)
    expect(new Set(duplicateFixture.events.map(e => e.eventId)).size).toBe(1)

    const records = outOfOrderFixture.events.map((event, index) => {
      const tokens = event.unit === 'token'
      return {
        usageEventId: event.eventId,
        requestId: 'air_fixture_order',
        occurredAt: event.occurredAt,
        rateVersion: 7,
        charged: { currency: 'USD', amountMinor: tokens ? 4 : 1 },
        status: 'settled',
        usage: {
          resource: tokens ? 'ai_tokens' : 'ai_request',
          quantity: event.quantity,
          unit: event.unit,
        },
        deliveryIndex: index,
      }
    }).map(({ deliveryIndex: _, ...record }) => record)
    const fetch = vi.fn<AiFetch>(async () => json({ items: records }))

    const page = await client(fetch).getUsage()

    expect(page.items.map(i => i.usageEventId)).toEqual(outOfOrderFixture.events.map(e => e.eventId))
    expect(page.items).toHaveLength(outOfOrderFixture.expected.settlementCount)
    expect(fetch).toHaveBeenCalledWith(
      'https://api.xmcl.test/v1/ai/usage',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
    expect(fetch.mock.calls.every(([url]) => !String(url).includes('/internal/'))).toBe(true)
  })
})
