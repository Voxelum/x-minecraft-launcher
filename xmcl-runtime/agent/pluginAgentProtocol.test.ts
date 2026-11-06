import { AGENT_PROXY_ENDPOINT } from '@xmcl/runtime-api'
import { describe, expect, test, vi } from 'vitest'
vi.mock('./AgentService', () => ({ AgentService: class {}, kResolvedAgentProvider: Symbol('resolved-provider') }))
vi.mock('~/xmclAccount', () => ({ XmclAccountService: class {}, kXmclSessionAuthorization: Symbol('authorization') }))
import type { Context } from '~/app'
import { createAgentProtocolHandler } from './providerProtocol'
import { LauncherProtocolHandler } from '../app/LauncherProtocolHandler'
import { pluginCommonProtocol } from '../app/pluginCommonProtocol'
import { pluginAgentProtocol } from './pluginAgentProtocol'
import { kResolvedAgentProvider } from './AgentService'

function context(url = AGENT_PROXY_ENDPOINT, headers: Record<string, any> = {}): Context {
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
  test('dispatches the local renderer transport through the registered plugin to a custom provider', async () => {
    const protocol = new LauncherProtocolHandler()
    const fetch = vi.fn(async () => new Response('custom provider response'))
    const app = {
      protocol, fetch,
      registry: { getOrCreate: async () => ({ [kResolvedAgentProvider]: async () => ({
        mode: 'custom', endpoint: 'https://provider.example/v1/chat/completions', apiKey: 'custom-key', model: 'local-model',
      }) }) },
    }
    pluginAgentProtocol(app as any, {} as any)
    pluginCommonProtocol(app as any, {} as any)
    const response = await protocol.handle({ url: 'http://launcher/agent/chat/completions', method: 'POST', body: '{}' })
    expect(response.status).toBe(200)
    expect(fetch).toHaveBeenCalledWith('https://provider.example/v1/chat/completions', expect.objectContaining({
      headers: { authorization: 'Bearer custom-key' }, method: 'POST',
    }))
  })
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
    const ctx = context('http://launcher/agent/chat/completions', {
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
    const ctx = context(AGENT_PROXY_ENDPOINT, { authorization: 'Bearer renderer-value' })

    await handler(ctx)

    expect(ctx.request.url.toString()).toBe('https://ai.xmcl.app/v1/chat/completions')
    expect(ctx.request.headers).toEqual({
      authorization: 'Bearer xmcl-token',
      'x-xmcl-account-id': 'account-id',
    })
    expect(ctx.request.skipRemainingHandlers).toBe(true)
  })

  test('authenticates builtin mode with a URL-specific DPoP proof', async () => {
    const resolveXmclAuthorization = vi.fn(async () => ({
      accessToken: 'xmcl-token',
      accountId: 'account-id',
      tokenType: 'DPoP' as const,
      dpopProof: 'proof-for-final-url',
    }))
    const handler = createAgentProtocolHandler(
      async () => ({ mode: 'builtin' }),
      resolveXmclAuthorization,
    )
    const ctx = context(AGENT_PROXY_ENDPOINT, { authorization: 'stale' })

    await handler(ctx)

    expect(resolveXmclAuthorization).toHaveBeenCalledWith({
      method: 'POST',
      url: new URL('https://ai.xmcl.app/v1/chat/completions'),
    })
    expect(ctx.request.headers).toMatchObject({
      authorization: 'DPoP xmcl-token',
      DPoP: 'proof-for-final-url',
      'x-xmcl-account-id': 'account-id',
    })
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
    expect(ctx.request.url.toString()).toBe(AGENT_PROXY_ENDPOINT)
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
