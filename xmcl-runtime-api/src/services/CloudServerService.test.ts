import { describe, expect, test } from 'vitest'
import {
  CloudServerApiClient,
  CloudServerApiError,
  CloudServerListSchema,
  CloudServerSchema,
  CloudServerStatusSchema,
  CloudServerTaskSchema,
  classifyCloudServerError,
  isCloudServerTaskTerminal,
} from './CloudServerService'
import { cloudServerErrorFixtures, cloudServerFixtures } from './CloudServerService.fixtures'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createClient(fetch: typeof globalThis.fetch, maxAttempts = 1) {
  return new CloudServerApiClient({
    baseUrl: 'https://m4.test',
    fetch,
    getSessionToken: () => 'xmcl-session',
    maxAttempts,
  })
}

describe('CloudServer public proposal schemas', () => {
  test('accepts every M4 server status', () => {
    const statuses = [
      'creating',
      'stopped',
      'starting',
      'running',
      'stopping',
      'suspended',
      'billing_blocked',
      'failed',
      'deleting',
      'deleted',
    ]
    expect(statuses.map(status => CloudServerStatusSchema.parse(status))).toEqual(statuses)
  })

  test('strictly parses public resources and tasks', () => {
    expect(CloudServerSchema.parse(cloudServerFixtures.stopped)).toEqual(cloudServerFixtures.stopped)
    expect(CloudServerListSchema.parse([cloudServerFixtures.stopped])).toEqual([cloudServerFixtures.stopped])
    expect(CloudServerTaskSchema.parse(cloudServerFixtures.taskRunning)).toEqual(cloudServerFixtures.taskRunning)
    expect(isCloudServerTaskTerminal(cloudServerFixtures.taskRunning)).toBe(false)
    expect(isCloudServerTaskTerminal(cloudServerFixtures.taskProviderFailed)).toBe(true)
  })

  test('rejects provider-only fields and secrets', () => {
    expect(CloudServerSchema.safeParse({
      ...cloudServerFixtures.stopped,
      providerResourceId: 'vultr-instance-01',
    }).success).toBe(false)
    expect(CloudServerSchema.safeParse({
      ...cloudServerFixtures.stopped,
      vultrToken: 'not-a-real-token',
    }).success).toBe(false)
  })
})

describe('CloudServerApiClient', () => {
  test('consumes server, task, and usage endpoints with an XMCL session', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString()
      requests.push({ url, init })
      if (url.endsWith('/v1/servers')) return jsonResponse([cloudServerFixtures.stopped])
      if (url.includes('/v1/tasks/')) return jsonResponse(cloudServerFixtures.taskRunning)
      if (url.endsWith('/usage')) return jsonResponse(cloudServerFixtures.usage)
      return jsonResponse(cloudServerFixtures.stopped)
    }) as typeof globalThis.fetch
    const client = createClient(fetch)

    await expect(client.listServers()).resolves.toEqual([cloudServerFixtures.stopped])
    await expect(client.getServer('srv_test_01')).resolves.toEqual(cloudServerFixtures.stopped)
    await expect(client.getTask('task_start_01')).resolves.toEqual(cloudServerFixtures.taskRunning)
    await expect(client.getUsage('srv_test_01')).resolves.toEqual(cloudServerFixtures.usage)

    for (const request of requests) {
      const headers = new Headers(request.init?.headers)
      expect(headers.get('Authorization')).toBe('Bearer xmcl-session')
      expect(request.url).toMatch(/^https:\/\/m4\.test\/v1\//)
    }
  })

  test('uses the supplied idempotency key for every server mutation', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = []
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: input.toString(), init })
      return jsonResponse(cloudServerFixtures.taskAccepted, 202)
    }) as typeof globalThis.fetch
    const client = createClient(fetch)
    const options = { idempotencyKey: 'stable-operation-01' }

    await client.createServer({ plan: 'xmcl-tpe-x86-small' }, options)
    await client.startServer('srv_test_01', options)
    await client.stopServer('srv_test_01', options)
    await client.restartServer('srv_test_01', options)
    await client.deleteServer('srv_test_01', options)

    expect(requests.map(request => [request.init?.method, new URL(request.url).pathname])).toEqual([
      ['POST', '/v1/servers'],
      ['POST', '/v1/servers/srv_test_01/start'],
      ['POST', '/v1/servers/srv_test_01/stop'],
      ['POST', '/v1/servers/srv_test_01/restart'],
      ['DELETE', '/v1/servers/srv_test_01'],
    ])
    for (const request of requests) {
      expect(new Headers(request.init?.headers).get('Idempotency-Key')).toBe('stable-operation-01')
    }
    expect(JSON.stringify(requests)).not.toMatch(/vultr.?token/i)
  })

  test('retries an ambiguous transport failure with the same idempotency key', async () => {
    const seenKeys: string[] = []
    let attempt = 0
    const fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
      seenKeys.push(new Headers(init?.headers).get('Idempotency-Key') ?? '')
      if (++attempt === 1) throw new TypeError('connection reset')
      return jsonResponse(cloudServerFixtures.taskAccepted, 202)
    }) as typeof globalThis.fetch
    const client = createClient(fetch, 2)

    await expect(client.startServer('srv_test_01', { idempotencyKey: 'start-retry-01' }))
      .resolves.toEqual(cloudServerFixtures.taskAccepted)
    expect(seenKeys).toEqual(['start-retry-01', 'start-retry-01'])
  })

  test.each(Object.entries(cloudServerErrorFixtures))(
    'exposes sanitized %s errors',
    async (category, fixture) => {
      const fetch = (async () => jsonResponse(fixture.body, fixture.status)) as typeof globalThis.fetch
      const client = createClient(fetch)
      const error = await client.startServer('srv_test_01', { idempotencyKey: `error-${category}` })
        .catch(cause => cause)

      expect(error).toBeInstanceOf(CloudServerApiError)
      expect(error).toMatchObject({
        status: fixture.status,
        errorCode: fixture.body.error,
        requestId: fixture.body.requestId,
        category,
      })
      expect((error as CloudServerApiError).message).toBe(fixture.body.message)
    },
  )

  test('rejects invalid retry keys before sending a request', async () => {
    let calls = 0
    const fetch = (async () => {
      calls++
      return jsonResponse(cloudServerFixtures.taskAccepted, 202)
    }) as typeof globalThis.fetch
    const client = createClient(fetch)

    expect(() => client.stopServer('srv_test_01', { idempotencyKey: ' ' })).toThrow(RangeError)
    expect(calls).toBe(0)
  })

  test('classifies documented error families', () => {
    expect(classifyCloudServerError(401, 'session_required')).toBe('permission')
    expect(classifyCloudServerError(402, 'usage_authorization_rejected')).toBe('balance')
    expect(classifyCloudServerError(429, 'quota_exceeded')).toBe('quota')
    expect(classifyCloudServerError(503, 'provider_timeout')).toBe('provider')
    expect(classifyCloudServerError(409, 'server_state_conflict')).toBe('api')
  })

  test('does not expose provider credentials or raw provider responses from error details', async () => {
    const fetch = (async () => jsonResponse({
      error: 'provider_unavailable',
      message: 'The server provider is temporarily unavailable.',
      requestId: 'req_sanitized',
      details: {
        status: 'creating',
        vultrToken: 'not-a-real-token',
        providerResponse: { raw: 'provider payload' },
      },
    }, 503)) as typeof globalThis.fetch
    const client = createClient(fetch)

    const error = await client.createServer(
      { plan: 'xmcl-tpe-x86-small' },
      { idempotencyKey: 'create-sanitized-01' },
    ).then(() => undefined, cause => cause as CloudServerApiError)

    expect(error).toBeInstanceOf(CloudServerApiError)
    expect(error?.details).toEqual({ status: 'creating' })
    expect(JSON.stringify(error)).not.toMatch(/vultrToken|provider payload/)
  })
})
