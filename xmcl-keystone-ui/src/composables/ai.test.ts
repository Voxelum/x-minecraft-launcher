import type {
  AiRequest,
  AiService,
} from '@xmcl/runtime-api'
import { describe, expect, test, vi } from 'vitest'
import { createAiClientState, normalizeAiClientError } from './ai'

function createService(overrides: Partial<AiService> = {}): AiService {
  return {
    getModels: async () => [],
    request: async request => ({
      requestId: request.idempotencyKey,
      providerRequestId: 'provider-fixture',
      output: 'fixture result',
      usage: [{ resource: 'ai_request', quantity: 1, unit: 'request' }],
    }),
    getUsage: async () => ({ items: [] }),
    ...overrides,
  }
}

describe('AI client state', () => {
  test('creates one idempotency key per intent and reuses it only for retry', async () => {
    const requests: AiRequest[] = []
    let attempt = 0
    const service = createService({
      request: vi.fn(async (request) => {
        requests.push(request)
        if (attempt++ === 0) {
          throw Object.assign(new Error('provider body containing secret'), {
            code: 'ai_provider_unavailable',
            requestId: 'server-provider-failure',
            status: 502,
            retryable: true,
          })
        }
        return {
          requestId: 'air-fixture',
          providerRequestId: 'provider-fixture',
          output: 'safe result',
          usage: [{ resource: 'ai_request' as const, quantity: 1, unit: 'request' as const }],
        }
      }),
    })
    const keys = ['intent-one', 'intent-two']
    const state = createAiClientState(service, () => keys.shift()!)

    await state.submit({ capability: 'troubleshoot', input: 'fixture one' })
    expect(state.error.value).toMatchObject({
      code: 'ai_provider_unavailable',
      message: 'The AI provider is temporarily unavailable.',
    })
    await state.retry()
    await state.submit({ capability: 'troubleshoot', input: 'fixture two' })

    expect(requests.map(r => r.idempotencyKey)).toEqual([
      'intent-one',
      'intent-one',
      'intent-two',
    ])
    expect(state.result.value?.output).toBe('safe result')
  })

  test('keeps server-published rates and confirmed charges without calculating a balance', async () => {
    const service = createService({
      getModels: async () => [{
        model: 'provider-neutral-small',
        capability: 'troubleshoot',
        usageResources: ['ai_request', 'ai_tokens'],
        rates: [{
          resource: 'ai_tokens',
          unit: 'token',
          rateVersion: 7,
          price: { currency: 'USD', amountMinor: 1 },
        }],
      }],
      getUsage: async query => query?.cursor
        ? {
            items: [{
              usageEventId: 'air-one:ai_tokens',
              requestId: 'air-one',
              occurredAt: '2026-07-22T10:02:00.000Z',
              rateVersion: 7,
              charged: { currency: 'USD', amountMinor: 4 },
              status: 'settled',
              usage: { resource: 'ai_tokens', quantity: 42, unit: 'token' },
            }, {
              usageEventId: 'air-two:ai_request',
              requestId: 'air-two',
              occurredAt: '2026-07-22T10:01:00.000Z',
              rateVersion: 7,
              charged: { currency: 'USD', amountMinor: 1 },
              status: 'settled',
              usage: { resource: 'ai_request', quantity: 1, unit: 'request' },
            }],
          }
        : {
            items: [{
              usageEventId: 'air-one:ai_tokens',
              requestId: 'air-one',
              occurredAt: '2026-07-22T10:02:00.000Z',
              rateVersion: 7,
              charged: { currency: 'USD', amountMinor: 4 },
              status: 'settled',
              usage: { resource: 'ai_tokens', quantity: 42, unit: 'token' },
            }],
            nextCursor: 'next',
          },
    })
    const state = createAiClientState(service)

    await state.refreshModels()
    await state.refreshUsage()
    await state.loadMoreUsage()

    expect(state.models.value[0].rates?.[0].price).toEqual({ currency: 'USD', amountMinor: 1 })
    expect(state.usage.value.map(record => record.charged.amountMinor)).toEqual([4, 1])
    expect(state.usage.value.map(record => record.usageEventId)).toEqual([
      'air-one:ai_tokens',
      'air-two:ai_request',
    ])
  })

  test.each([
    ['ai_unauthenticated', 401],
    ['ai_forbidden', 403],
    ['insufficient_balance', 402],
    ['ai_authorization_conflict', 409],
  ])('keeps stable client-facing error %s', (code, status) => {
    expect(normalizeAiClientError({ code, status, message: code })).toMatchObject({
      code,
      status,
    })
  })
})
