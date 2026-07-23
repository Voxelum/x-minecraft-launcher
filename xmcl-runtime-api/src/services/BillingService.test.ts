import { describe, expect, test } from 'vitest'
import {
  BillingApiClient,
  BillingApiError,
  CanonicalUsageEventSchema,
  UsageAuthorizationRequestSchema,
  classifyBillingError,
  formatMoney,
} from './BillingService'

const order = {
  orderId: 'paypal-order-fixture-1',
  status: 'approval_required' as const,
  approvalUrl: 'https://www.paypal.com/checkoutnow?token=fixture-order-1',
}
const balance = {
  accountId: 'account-fixture-1',
  available: { currency: 'USD', amountMinor: 1000 },
  reserved: { currency: 'USD', amountMinor: 0 },
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createClient(fetch: typeof globalThis.fetch, maxAttempts = 1, session = 'xmcl-session') {
  return new BillingApiClient({
    baseUrl: 'https://m3.test',
    fetch,
    getSessionToken: () => session,
    createIdempotencyKey: () => 'paypal-order-intent-fixture-1',
    maxAttempts,
  })
}

describe('formatMoney', () => {
  test('formats currencies using their configured minor units', () => {
    expect(formatMoney({ currency: 'USD', amountMinor: 1234 }, 'en-US')).toBe('$12.34')
    expect(formatMoney({ currency: 'JPY', amountMinor: 1234 }, 'ja-JP')).toBe('￥1,234')
    expect(formatMoney({ currency: 'BHD', amountMinor: 1234 }, 'en-US')).toBe('BHD 1.234')
  })

  test.each([
    { currency: 'usd', amountMinor: 100 },
    { currency: 'US', amountMinor: 100 },
    { currency: 'USD', amountMinor: -1 },
    { currency: 'USD', amountMinor: 1.5 },
    { currency: 'USD', amountMinor: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid money values: $currency $amountMinor', (money) => {
    expect(() => formatMoney(money, 'en-US')).toThrow()
  })
})

describe('shared v1 usage fields', () => {
  test('uses the published authorization and canonical event field names', () => {
    const authorization = UsageAuthorizationRequestSchema.parse({
      accountId: 'acct_123',
      resource: 'server_time',
      sourceId: 'lease_123',
      expectedQuantity: 3600,
      unit: 'second',
      settlementIntervalSeconds: 3600,
      rateVersion: 1,
      idempotencyKey: 'm4:start:server_123:1',
      expiresAt: '2026-07-23T00:00:00Z',
    })
    const event = CanonicalUsageEventSchema.parse({
      eventType: 'usage.recorded.v1',
      eventId: 'usage_123',
      schemaVersion: 1,
      accountId: authorization.accountId,
      authorizationId: 'auth_123',
      resource: authorization.resource,
      sourceId: authorization.sourceId,
      quantity: authorization.expectedQuantity,
      unit: authorization.unit,
      rateVersion: authorization.rateVersion,
      sequence: 1,
      intervalStart: '2026-07-22T23:00:00Z',
      intervalEnd: '2026-07-23T00:00:00Z',
      occurredAt: '2026-07-23T00:00:00Z',
      idempotencyKey: 'm5:lease_123:1',
    })
    expect(event.unit).not.toBe('byte')
    expect(event.eventType).toBe('usage.recorded.v1')
  })
})

describe('BillingApiClient', () => {
  test('uses authenticated transport for balance, rates, ledger, and usage reads', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: input.toString(), init })
      const url = input.toString()
      if (url.includes('/rates')) return jsonResponse([])
      if (url.includes('/ledger')) return jsonResponse({ items: [] })
      if (url.includes('/usage')) return jsonResponse({ items: [] })
      return jsonResponse(balance)
    }) as typeof globalThis.fetch
    const client = createClient(fetch)

    await expect(client.getBalance()).resolves.toEqual(balance)
    await expect(client.getRates()).resolves.toEqual([])
    await expect(client.getLedger({ cursor: 'next', limit: 10 })).resolves.toEqual({ items: [] })
    await expect(client.getUsage()).resolves.toEqual({ items: [] })

    for (const request of requests) {
      expect(new Headers(request.init?.headers).get('Authorization')).toBe('Bearer xmcl-session')
      expect(request.url).toMatch(/^https:\/\/m3\.test\/v1\/billing\//)
    }
    expect(requests[2].url).toContain('cursor=next')
    expect(requests[2].url).toContain('limit=10')
  })

  test('rejects unauthenticated billing reads without sending a request', async () => {
    const fetch = (async () => jsonResponse(balance)) as typeof globalThis.fetch
    const client = createClient(fetch, 1, '')

    await expect(client.getBalance()).rejects.toMatchObject({
      errorCode: 'session_required',
      category: 'permission',
    })
  })

  test('reuses one generated key for a payment intent and transport retries', async () => {
    const keys: string[] = []
    const bodies: string[] = []
    let attempt = 0
    const fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get('Idempotency-Key') ?? '')
      bodies.push(String(init?.body))
      if (++attempt === 1) throw new TypeError('connection reset')
      return jsonResponse(order, 201)
    }) as typeof globalThis.fetch
    const client = createClient(fetch, 2)
    const intent = {
      intentId: 'intent-fixture-1',
      accountId: 'account-fixture-1',
      cashAmount: { currency: 'USD', amountMinor: 1000 },
    }

    await expect(client.createPaypalOrder(intent)).resolves.toEqual(order)
    await expect(client.createPaypalOrder(intent)).resolves.toEqual(order)
    expect(keys).toEqual([
      'paypal-order-intent-fixture-1',
      'paypal-order-intent-fixture-1',
      'paypal-order-intent-fixture-1',
    ])
    expect(bodies).toEqual([
      JSON.stringify({ amountMinor: 1000 }),
      JSON.stringify({ amountMinor: 1000 }),
      JSON.stringify({ amountMinor: 1000 }),
    ])
  })

  test('does not allow an existing payment intent to change its cash amount', async () => {
    const fetch = (async () => jsonResponse(order, 201)) as typeof globalThis.fetch
    const client = createClient(fetch)
    await client.createPaypalOrder({
      intentId: 'intent-fixture-1',
      accountId: 'account-fixture-1',
      cashAmount: { currency: 'USD', amountMinor: 1000 },
    })

    await expect(
      client.createPaypalOrder({
        intentId: 'intent-fixture-1',
        accountId: 'account-fixture-1',
        cashAmount: { currency: 'USD', amountMinor: 2000 },
      }),
    ).rejects.toThrow(RangeError)
  })

  test('refreshes server order and balance after capture or an approval/cancel callback', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString()
      requests.push({ url, init })
      if (url.endsWith('/capture')) return jsonResponse({ accepted: true })
      if (url.endsWith('/orders')) return jsonResponse({ items: [order] })
      return jsonResponse(balance)
    }) as typeof globalThis.fetch
    const client = createClient(fetch)

    await expect(client.capturePaypalOrder(order.orderId)).resolves.toEqual({ order, balance })
    await expect(client.refreshPaypalOrder(order.orderId)).resolves.toEqual({ order, balance })
    expect(requests.map((request) => request.url)).toEqual([
      'https://m3.test/v1/billing/paypal/orders/paypal-order-fixture-1/capture',
      'https://m3.test/v1/billing/orders',
      'https://m3.test/v1/billing/balance',
      'https://m3.test/v1/billing/orders',
      'https://m3.test/v1/billing/balance',
    ])
    expect(new Headers(requests[0].init?.headers).get('Idempotency-Key')).toBe(
      'paypal-order-intent-fixture-1',
    )
  })

  test('maps provider, permission, duplicate, out-of-order, and state-conflict fixtures', async () => {
    expect(classifyBillingError(503, 'payment_provider_unavailable')).toBe('provider')
    expect(classifyBillingError(403, 'insufficient_scope')).toBe('permission')
    expect(classifyBillingError(409, 'usage_duplicate')).toBe('conflict')
    expect(classifyBillingError(409, 'usage_out_of_order')).toBe('conflict')
    expect(classifyBillingError(409, 'usage_authorization_state_conflict')).toBe('conflict')

    const fetch = (async () =>
      jsonResponse(
        {
          error: 'payment_provider_unavailable',
          message: 'The payment provider is temporarily unavailable.',
          requestId: 'request-provider-failure',
        },
        503,
      )) as typeof globalThis.fetch
    const error = await createClient(fetch)
      .createPaypalOrder({
        intentId: 'provider-failure',
        accountId: 'account-fixture-1',
        cashAmount: { currency: 'USD', amountMinor: 1000 },
      })
      .catch((cause) => cause)

    expect(error).toBeInstanceOf(BillingApiError)
    expect(error).toMatchObject({
      errorCode: 'payment_provider_unavailable',
      category: 'provider',
      retryable: true,
    })
  })

  test.each([
    ['permission', 403, 'insufficient_scope', 'permission'],
    ['duplicate', 409, 'usage_duplicate', 'conflict'],
    ['out-of-order', 409, 'usage_out_of_order', 'conflict'],
    ['state-conflict', 409, 'usage_authorization_state_conflict', 'conflict'],
  ] as const)('maps the %s fixture response', async (_fixture, status, errorCode, category) => {
    const fetch = (async () =>
      jsonResponse(
        {
          error: errorCode,
          message: 'Fixture error.',
          requestId: `request-${errorCode}`,
        },
        status,
      )) as typeof globalThis.fetch

    await expect(createClient(fetch).getBalance()).rejects.toMatchObject({
      status,
      errorCode,
      category,
    })
  })

  test('reports a terminal network failure without treating it as payment completion', async () => {
    const fetch = (async () => {
      throw new TypeError('connection reset')
    }) as typeof globalThis.fetch

    await expect(createClient(fetch).getBalance()).rejects.toMatchObject({
      errorCode: 'network_error',
      category: 'network',
      retryable: true,
    })
  })
})
