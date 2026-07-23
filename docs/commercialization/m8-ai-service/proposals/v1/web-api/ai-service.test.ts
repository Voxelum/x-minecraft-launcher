import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { HttpAiProvider } from './ai-provider'
import { AiRequestService } from './ai-service'
import { MemoryAiRepository } from './memory-repository'
import { handleAiRequest } from './route-proposal'
import {
  AiModel,
  AiProvider,
  AiProviderError,
  AiResult,
  CanonicalUsageEventMock,
  M1SessionMock,
  UsageAuthorizationError,
  UsageAuthorizationMock,
  UsageAuthorizationRequestMock,
  UsageAuthorizer,
  UsagePublisher,
  UsagePublishError,
  UsageSettlementResultMock,
} from './types'

const now = new Date('2026-07-22T10:00:00.000Z')
const model: AiModel = {
  capability: 'troubleshoot',
  model: 'provider-neutral-small',
  maxInputLength: 1_000,
  maxOutputTokens: 100,
  maxTotalTokens: 1_100,
  rateVersions: { ai_request: 7, ai_tokens: 8 },
}
const session: M1SessionMock = {
  sessionId: 'session_fixture_001',
  accountId: 'acct_fixture_001',
  scopes: ['ai:invoke'],
  expiresAt: '2099-01-01T00:00:00.000Z',
}

class Authorizer implements UsageAuthorizer {
  readonly calls: UsageAuthorizationRequestMock[][] = []
  readonly releases: UsageAuthorizationMock[][] = []
  error?: UsageAuthorizationError

  async authorizeAll(requests: UsageAuthorizationRequestMock[]): Promise<UsageAuthorizationMock[]> {
    this.calls.push(structuredClone(requests))
    if (this.error) throw this.error
    return requests.map(request => ({
      authorizationId: `auth_${request.resource}`,
      accountId: request.accountId,
      resource: request.resource,
      sourceId: request.sourceId,
      status: 'authorized',
      rateVersion: request.rateVersion,
      expiresAt: request.expiresAt,
      actionOnExhaustion: 'stop_required',
    }))
  }

  async releaseAll(authorizations: UsageAuthorizationMock[]): Promise<void> {
    this.releases.push(structuredClone(authorizations))
  }
}

class Provider implements AiProvider {
  readonly calls: Parameters<AiProvider['invoke']>[0][] = []
  error?: Error

  async invoke(request: Parameters<AiProvider['invoke']>[0]): Promise<Omit<AiResult, 'requestId'>> {
    this.calls.push(structuredClone(request))
    if (this.error) throw this.error
    return {
      providerRequestId: 'provider_fixture_success',
      output: 'Sanitized fixture result.',
      usage: [
        { resource: 'ai_request', quantity: 1, unit: 'request' },
        { resource: 'ai_tokens', quantity: 42, unit: 'token' },
      ],
    }
  }
}

class Publisher implements UsagePublisher {
  readonly calls: CanonicalUsageEventMock[] = []
  outcomes = new Map<string, Array<UsageSettlementResultMock | UsagePublishError>>()

  async publish(event: CanonicalUsageEventMock): Promise<UsageSettlementResultMock> {
    this.calls.push(structuredClone(event))
    const outcome = this.outcomes.get(event.resource)?.shift() ?? {
      settlementId: `settlement_${event.eventId}`,
      usageEventId: event.eventId,
      action: 'continue' as const,
      status: 'settled' as const,
      rateVersion: event.rateVersion,
    }
    if (outcome instanceof UsagePublishError) throw outcome
    return outcome
  }
}

function setup(requestId = 'air_fixture_success') {
  const repository = new MemoryAiRepository()
  const authorizer = new Authorizer()
  const provider = new Provider()
  const publisher = new Publisher()
  const service = new AiRequestService({
    models: [model],
    repository,
    authorizer,
    provider,
    usagePublisher: publisher,
    now: () => now,
    createRequestId: () => requestId,
  })
  return { repository, authorizer, provider, publisher, service }
}

function routeRequest(overrides: Partial<Parameters<typeof handleAiRequest>[0]> = {}) {
  return {
    requestId: 'http_fixture_001',
    session,
    capability: 'troubleshoot',
    idempotencyKey: 'ai-intent-success',
    body: { input: 'The game exits before the window opens.' },
    ...overrides,
  }
}

function fixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8')) as T
}

describe('M8 request boundary', () => {
  test('rejects API errors and authentication failures before M3 or provider calls', async () => {
    const invalid = fixture<{ expected: { status: number; error: string } }>('error')
    const permission = fixture<{ expected: { status: number; error: string } }>('permission')
    const state = setup()

    const unauthorized = await handleAiRequest(routeRequest({ session: undefined }), state.service)
    const forbidden = await handleAiRequest(
      routeRequest({ session: { ...session, scopes: ['account:read'] } }),
      state.service,
    )
    const invalidResponse = await handleAiRequest(routeRequest({ body: { input: '', accountId: 'other' } }), state.service)

    expect(unauthorized).toMatchObject({ status: 401, body: { error: 'ai_unauthenticated' } })
    expect(forbidden).toMatchObject({ status: permission.expected.status, body: { error: permission.expected.error } })
    expect(invalidResponse).toMatchObject({ status: invalid.expected.status, body: { error: invalid.expected.error } })
    expect(state.authorizer.calls).toHaveLength(0)
    expect(state.provider.calls).toHaveLength(0)
  })

  test('authorizes both meters before provider success and persists canonical outbox usage', async () => {
    const success = fixture<{
      expected: { providerCalls: number; usageEventIds: string[] }
    }>('success')
    const state = setup()

    const response = await handleAiRequest(routeRequest(), state.service)

    expect(response).toMatchObject({
      status: 200,
      body: {
        requestId: 'air_fixture_success',
        providerRequestId: 'provider_fixture_success',
      },
    })
    expect(state.authorizer.calls).toHaveLength(1)
    expect(state.authorizer.calls[0].map(request => request.resource)).toEqual(['ai_request', 'ai_tokens'])
    expect(state.authorizer.calls[0][1].expectedQuantity).toBe(model.maxTotalTokens)
    expect(state.authorizer.calls[0][0].sourceId).toBe(state.publisher.calls[0].sourceId)
    expect(state.authorizer.calls[0][0].settlementIntervalSeconds).toBe(300)
    expect(state.publisher.calls[0]).toMatchObject({
      eventType: 'usage.recorded.v1',
      rateVersion: 7,
      intervalStart: now.toISOString(),
      intervalEnd: '2026-07-22T10:05:00.000Z',
    })
    expect(state.provider.calls).toHaveLength(success.expected.providerCalls)
    expect([...state.repository.usage.keys()]).toEqual(success.expected.usageEventIds)
    expect([...state.repository.usage.values()].map(event => event.status)).toEqual(['published', 'published'])
    expect(JSON.stringify([...state.repository.requests.values()])).not.toContain('The game exits')
    expect(state.publisher.calls[0].authorizationId).toBe('auth_ai_request')
    expect(state.publisher.calls[1].authorizationId).toBe('auth_ai_tokens')
  })

  test('returns the persisted result for an idempotent retry without repeating side effects', async () => {
    const retry = fixture<{ expected: { providerCalls: number; sameResult: boolean; settlementCount: number } }>(
      'idempotent-retry',
    )
    const state = setup('air_fixture_retry')
    const request = routeRequest({ idempotencyKey: 'ai-intent-retry' })

    const first = await handleAiRequest(request, state.service)
    const second = await handleAiRequest(request, state.service)

    expect(first.body).toEqual(second.body)
    expect(retry.expected.sameResult).toBe(true)
    expect(state.provider.calls).toHaveLength(retry.expected.providerCalls)
    expect(state.authorizer.calls).toHaveLength(1)
    expect(state.publisher.calls).toHaveLength(retry.expected.settlementCount)
  })

  test('rejects reuse of an idempotency key for a different intent', async () => {
    const state = setup('air_fixture_idempotency_conflict')
    const first = routeRequest({ idempotencyKey: 'ai-intent-conflict' })

    await handleAiRequest(first, state.service)
    const conflicting = await handleAiRequest(
      routeRequest({
        idempotencyKey: 'ai-intent-conflict',
        body: { input: 'A different prompt.' },
      }),
      state.service,
    )

    expect(conflicting).toMatchObject({
      status: 409,
      body: { error: 'ai_idempotency_conflict' },
    })
    expect(state.provider.calls).toHaveLength(1)
    expect(state.authorizer.calls).toHaveLength(1)
  })

  test('does not call provider after insufficient balance or authorization state conflict', async () => {
    const insufficient = fixture<{ expected: { status: number; error: string } }>('insufficient-balance')
    const conflict = fixture<{ expected: { status: number; error: string } }>('state-conflict')

    const rejected = setup('air_fixture_balance')
    rejected.authorizer.error = new UsageAuthorizationError('insufficient_balance')
    const rejectedResponse = await handleAiRequest(routeRequest(), rejected.service)
    expect(rejectedResponse).toMatchObject({
      status: insufficient.expected.status,
      body: { error: insufficient.expected.error },
    })
    expect(rejected.provider.calls).toHaveLength(0)

    const expired = setup('air_fixture_conflict')
    expired.authorizer.error = new UsageAuthorizationError('state_conflict')
    const expiredResponse = await handleAiRequest(routeRequest(), expired.service)
    expect(expiredResponse).toMatchObject({
      status: conflict.expected.status,
      body: { error: conflict.expected.error },
    })
    expect(expired.provider.calls).toHaveLength(0)
  })

  test('sanitizes provider failure and emits no success usage', async () => {
    const providerFailure = fixture<{
      expected: { status: number; error: string; containsProviderBody: boolean; containsCredential: boolean }
    }>('provider-failure')
    const state = setup('air_fixture_provider_failure')
    state.provider.error = new Error('raw body with provider-secret')

    const response = await handleAiRequest(routeRequest(), state.service)
    const serialized = JSON.stringify(response)

    expect(response).toMatchObject({
      status: providerFailure.expected.status,
      body: { error: providerFailure.expected.error },
    })
    expect(serialized.includes('raw body')).toBe(providerFailure.expected.containsProviderBody)
    expect(serialized.includes('provider-secret')).toBe(providerFailure.expected.containsCredential)
    expect(state.repository.usage.size).toBe(0)
    expect(state.authorizer.releases).toHaveLength(1)
  })
})

describe('M8 usage outbox', () => {
  test('retries transient publication with identical event IDs and settles once', async () => {
    const retry = fixture<{ expected: { identifiersReused: boolean; settlementCount: number } }>('retry')
    const state = setup('air_fixture_publish_retry')
    state.publisher.outcomes.set('ai_tokens', [
      new UsagePublishError('transient'),
      {
        settlementId: 'settlement_retry',
        usageEventId: 'air_fixture_publish_retry:ai_tokens',
        action: 'continue',
        status: 'settled',
        rateVersion: 8,
      },
    ])

    await state.service.request({
      accountId: session.accountId,
      capability: 'troubleshoot',
      input: 'fixture',
      idempotencyKey: 'ai-intent-publish-retry',
    })
    await state.service.publishPendingUsage('air_fixture_publish_retry')

    const tokenCalls = state.publisher.calls.filter(event => event.resource === 'ai_tokens')
    expect(tokenCalls).toHaveLength(2)
    expect(tokenCalls[0]).toEqual(tokenCalls[1])
    expect(retry.expected.identifiersReused).toBe(true)
    expect([...state.repository.usage.values()].filter(event => event.status === 'published')).toHaveLength(
      retry.expected.settlementCount + 1,
    )
  })

  test.each(['duplicate', 'out-of-order'])(
    'publishes %s fixture events once using a distinct M8 request source',
    async (fixtureName) => {
    fixture(fixtureName)
    const state = setup(`air_fixture_${fixtureName}`)

    await state.service.request({
      accountId: session.accountId,
      capability: 'troubleshoot',
      input: 'fixture',
      idempotencyKey: `ai-intent-${fixtureName}`,
    })
    await state.service.publishPendingUsage(`air_fixture_${fixtureName}`)

    const token = state.repository.usage.get(`air_fixture_${fixtureName}:ai_tokens`)
    expect(token).toMatchObject({ status: 'published', attempts: 1 })
    expect(state.publisher.calls.filter(event => event.resource === 'ai_tokens')).toHaveLength(1)
    expect(token?.event.sourceId).toBe(`ai:air_fixture_${fixtureName}`)
  })

  test('records a post-provider balance conflict for reconciliation without automatic retry', async () => {
    const balance = fixture<{
      expected: { automaticRetry: boolean; deliveryStatus: string; requiresReconciliation: boolean }
    }>('balance-conflict')
    const state = setup('air_fixture_balance_conflict')
    state.publisher.outcomes.set('ai_tokens', [new UsagePublishError('balance_conflict')])

    await state.service.request({
      accountId: session.accountId,
      capability: 'troubleshoot',
      input: 'fixture',
      idempotencyKey: 'ai-intent-balance-conflict',
    })
    await state.service.publishPendingUsage('air_fixture_balance_conflict')

    const token = state.repository.usage.get('air_fixture_balance_conflict:ai_tokens')
    expect(token).toMatchObject({
      status: balance.expected.deliveryStatus,
      attempts: 1,
      lastError: 'balance_conflict',
    })
    expect(state.publisher.calls.filter(event => event.resource === 'ai_tokens')).toHaveLength(1)
    expect(balance.expected.automaticRetry).toBe(false)
    expect(balance.expected.requiresReconciliation).toBe(true)
  })
})

describe('server-side provider adapter', () => {
  test('keeps the key in the server header and maps measured provider usage', async () => {
    let captured: RequestInit | undefined
    const adapter = new HttpAiProvider(
      'https://provider.invalid/v1/respond',
      'provider-secret',
      async (_input, init) => {
        captured = init
        return Response.json({
          id: 'provider_request_1',
          output: 'safe output',
          usage: { inputTokens: 10, outputTokens: 5 },
        })
      },
    )

    const result = await adapter.invoke({
      requestId: 'air_adapter_1',
      capability: 'troubleshoot',
      model: 'provider-neutral-small',
      input: 'fixture',
      maxOutputTokens: 100,
    })

    expect(captured?.headers).toMatchObject({
      authorization: 'Bearer provider-secret',
      'idempotency-key': 'air_adapter_1',
    })
    expect(JSON.stringify(captured?.body)).not.toContain('provider-secret')
    expect(result.usage).toEqual([
      { resource: 'ai_request', quantity: 1, unit: 'request' },
      { resource: 'ai_tokens', quantity: 15, unit: 'token' },
    ])
  })

  test('does not expose provider response bodies or credentials on failure', async () => {
    const adapter = new HttpAiProvider(
      'https://provider.invalid/v1/respond',
      'provider-secret',
      async () => new Response('raw provider failure provider-secret', { status: 500 }),
    )

    const invocation = adapter.invoke({
      requestId: 'air_adapter_2',
      capability: 'troubleshoot',
      model: 'provider-neutral-small',
      input: 'fixture',
      maxOutputTokens: 100,
    })

    await expect(invocation).rejects.toBeInstanceOf(AiProviderError)
    await expect(invocation).rejects.not.toThrow(/raw provider failure|provider-secret/)
  })
})
