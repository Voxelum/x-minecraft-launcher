import { BUILTIN_AGENT_ENDPOINT } from '@xmcl/runtime-api'
import { describe, expect, test, vi } from 'vitest'
import type { Context } from '~/app'
import { createAgentProtocolHandler } from './providerProtocol'

function context(url = BUILTIN_AGENT_ENDPOINT, headers: Record<string, any> = {}): Context {
  return {
    request: {
      method: 'POST',
      url: new URL(url),
      headers,
      body: '{}',
    },
    response: { headers: {} },
    handle: vi.fn(),
  }
}

describe('agent protocol', () => {
  test('routes custom mode to its endpoint with its stored key', async () => {
    const handler = createAgentProtocolHandler(
      async () => ({
        mode: 'custom',
        endpoint: 'https://provider.example/v1/chat/completions',
        model: 'custom-model',
        apiKey: 'custom-key',
      }),
      async () => ({ accessToken: 'xmcl-token', accountId: 'account-id' }),
    )
    const ctx = context(BUILTIN_AGENT_ENDPOINT, {
      Authorization: 'Bearer renderer-value',
      'X-XMCL-Account-ID': 'renderer-account',
    })

    await handler(ctx)

    expect(ctx.request.url.toString()).toBe('https://provider.example/v1/chat/completions')
    expect(ctx.request.headers).toEqual({ authorization: 'Bearer custom-key' })
    expect(ctx.request.skipRemainingHandlers).toBe(true)
  })

  test('authenticates builtin mode with the XMCL session and account', async () => {
    const handler = createAgentProtocolHandler(
      async () => ({ mode: 'builtin' }),
      async () => ({ accessToken: 'xmcl-token', accountId: 'account-id' }),
    )
    const ctx = context(BUILTIN_AGENT_ENDPOINT, { authorization: 'Bearer renderer-value' })

    await handler(ctx)

    expect(ctx.request.url.toString()).toBe('https://ai.xmcl.app/v1/chat/completions')
    expect(ctx.request.headers).toEqual({
      authorization: 'Bearer xmcl-token',
      'x-xmcl-account-id': 'account-id',
    })
    expect(ctx.request.skipRemainingHandlers).toBe(true)
  })

  test('rejects builtin mode without an XMCL session', async () => {
    const handler = createAgentProtocolHandler(
      async () => ({ mode: 'builtin' }),
      async () => undefined,
    )
    const ctx = context()

    await handler(ctx)

    expect(ctx.response.status).toBe(401)
    expect(ctx.response.headers).toEqual({ 'content-type': 'application/json' })
    expect(ctx.response.handled).toBe(true)
  })

  test('rejects unconfigured mode without resolving XMCL authorization', async () => {
    const resolveXmclAuthorization = vi.fn(async () => ({
      accessToken: 'xmcl-token',
      accountId: 'account-id',
    }))
    const handler = createAgentProtocolHandler(
      async () => ({ mode: 'unconfigured' }),
      resolveXmclAuthorization,
    )
    const ctx = context()

    await handler(ctx)

    expect(ctx.response.status).toBe(401)
    expect(ctx.response.handled).toBe(true)
    expect(ctx.request.url.toString()).toBe(BUILTIN_AGENT_ENDPOINT)
    expect(resolveXmclAuthorization).not.toHaveBeenCalled()
  })

  test('ignores unrelated requests', async () => {
    const resolveProvider = vi.fn(async () => ({ mode: 'builtin' as const }))
    const handler = createAgentProtocolHandler(resolveProvider, async () => undefined)
    const ctx = context('https://api.xmcl.api/other')

    await handler(ctx)

    expect(resolveProvider).not.toHaveBeenCalled()
    expect(ctx.response.status).toBeUndefined()
  })
})