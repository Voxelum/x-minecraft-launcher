import { BUILTIN_AGENT_FLIGHT } from '@xmcl/runtime-api'
import { describe, expect, test, vi } from 'vitest'

vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherApp: class {},
  LauncherAppKey: Symbol('LauncherAppKey'),
}))

vi.mock('~/infra', () => ({
  kFlights: Symbol('kFlights'),
}))

vi.mock('~/settings', () => ({
  kSettings: Symbol('kSettings'),
}))

vi.mock('~/xmclAccount', () => ({
  kXmclSessionAuthorization: Symbol('kXmclSessionAuthorization'),
  XmclAccountService: class {},
}))

vi.mock('~/service', () => ({
  AbstractService: class {},
  ExposeServiceKey: () => () => {},
}))

const { AgentService, kResolvedAgentProvider } = await import('./AgentService')
const { kFlights } = await import('~/infra')
const { kSettings } = await import('~/settings')

function createServiceContext(flights: Record<string, unknown>) {
  const settings = {
    agentEndpoint: '',
    agentModel: '',
    agentProviderSet: vi.fn(),
  }
  return {
    app: {
      registry: {
        get: vi.fn(async key => key === kSettings ? settings : key === kFlights ? flights : undefined),
      },
      secretStorage: {
        get: vi.fn().mockResolvedValue(''),
        put: vi.fn(),
      },
    },
    settings,
    apiKeys: {
      get: vi.fn().mockResolvedValue(''),
    },
  }
}

describe('AgentService provider resolution', () => {
  test('reports empty settings as unconfigured when the built-in flight is absent', async () => {
    const context = createServiceContext({})
    const service = Object.assign(Object.create(AgentService.prototype), context)

    await expect(service.getProviderSettings()).resolves.toEqual({
      endpoint: '',
      model: '',
      configured: false,
      mode: 'unconfigured',
    })
  })

  test('does not select the built-in provider when its flight is absent', async () => {
    const service = createServiceContext({})

    await expect((AgentService.prototype as any)[kResolvedAgentProvider].call(service))
      .resolves.toEqual({ mode: 'unconfigured' })
  })

  test('selects the built-in provider only when its flight is enabled', async () => {
    const service = createServiceContext({ [BUILTIN_AGENT_FLIGHT]: true })

    await expect((AgentService.prototype as any)[kResolvedAgentProvider].call(service))
      .resolves.toEqual({ mode: 'builtin' })
  })

  test('requires endpoint, model, and API key for a custom provider', async () => {
    const service = createServiceContext({ [BUILTIN_AGENT_FLIGHT]: true })
    service.settings.agentEndpoint = 'https://provider.example/v1/chat/completions'
    service.settings.agentModel = 'provider-model'

    await expect((AgentService.prototype as any)[kResolvedAgentProvider].call(service))
      .resolves.toEqual({ mode: 'unconfigured' })
  })

  test('selects custom only when endpoint, model, and API key are all configured', async () => {
    const service = createServiceContext({})
    service.settings.agentEndpoint = 'https://provider.example/v1/chat/completions'
    service.settings.agentModel = 'provider-model'
    service.apiKeys.get.mockResolvedValue('provider-key')

    await expect((AgentService.prototype as any)[kResolvedAgentProvider].call(service))
      .resolves.toEqual({
        mode: 'custom',
        endpoint: 'https://provider.example/v1/chat/completions',
        model: 'provider-model',
        apiKey: 'provider-key',
      })
  })

  test('does not fall back to builtin for a partial custom configuration', async () => {
    const service = createServiceContext({ [BUILTIN_AGENT_FLIGHT]: true })
    service.settings.agentEndpoint = 'https://provider.example/v1/chat/completions'

    await expect((AgentService.prototype as any)[kResolvedAgentProvider].call(service))
      .resolves.toEqual({ mode: 'unconfigured' })
  })
})

describe('AgentService provider editing', () => {
  function editableService() {
    const context = createServiceContext({})
    context.settings.agentProviderSet.mockImplementation(({ endpoint, model }) => {
      context.settings.agentEndpoint = endpoint
      context.settings.agentModel = model
    })
    const keys = new Map<string, string>()
    const apiKeys = {
      get: vi.fn(async (endpoint: string) => keys.get(endpoint)),
      put: vi.fn(async (endpoint: string, value: string) => { keys.set(endpoint, value) }),
    }
    const service = Object.assign(Object.create(AgentService.prototype), context, { apiKeys, logAgent: vi.fn() }) as InstanceType<typeof AgentService>
    return { service, context, keys, apiKeys }
  }

  test.each(['not a url', 'file:///tmp/agent', 'https://user:password@example.test/v1'])('rejects invalid URL %s without storing credentials or settings', async endpoint => {
    const { service, context, apiKeys } = editableService()
    await expect(service.setProviderSettings({ endpoint, model: 'mock', apiKey: 'test-key' })).rejects.toThrow('Agent URL')
    expect(apiKeys.put).not.toHaveBeenCalled()
    expect(context.settings.agentProviderSet).not.toHaveBeenCalled()
  })

  test('rejects a key without URL rather than silently discarding it', async () => {
    const { service, context, apiKeys } = editableService()
    await expect(service.setProviderSettings({ endpoint: '', model: 'mock', apiKey: 'test-key' })).rejects.toThrow('Enter an Agent URL')
    expect(apiKeys.put).not.toHaveBeenCalled()
    expect(context.settings.agentProviderSet).not.toHaveBeenCalled()
  })

  test('keychain failure does not commit settings and a subsequent save succeeds', async () => {
    const { service, context, apiKeys } = editableService()
    apiKeys.put.mockRejectedValueOnce(new Error('mock keychain failure'))
    const input = { endpoint: 'http://127.0.0.1:1234/v1', model: 'mock', apiKey: 'mock-key' }
    await expect(service.setProviderSettings(input)).rejects.toThrow('mock keychain failure')
    expect(context.settings.agentProviderSet).not.toHaveBeenCalled()
    await service.setProviderSettings(input)
    expect(await (service as any)[kResolvedAgentProvider]()).toMatchObject({ mode: 'custom', apiKey: 'mock-key' })
  })

  test('local mock endpoint receives only its own saved key via provider protocol', async () => {
    const { createServer } = await import('node:http')
    const { createAgentProtocolHandler } = await import('./providerProtocol')
    const { BUILTIN_AGENT_ENDPOINT } = await import('@xmcl/runtime-api')
    const seen: Array<{ path: string; authorization?: string }> = []
    const server = createServer((request, response) => {
      seen.push({ path: request.url!, authorization: request.headers.authorization })
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'mock reply' } }] }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const endpoint = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}/v1/chat/completions`
      const { service } = editableService()
      await service.setProviderSettings({ endpoint: 'http://other.test/v1', model: 'mock', apiKey: 'other-key' })
      await service.setProviderSettings({ endpoint, model: 'mock' })
      expect(await (service as any)[kResolvedAgentProvider]()).toEqual({ mode: 'unconfigured' })
      await service.setProviderSettings({ endpoint, model: 'mock', apiKey: 'local-test-key' })
      const handler = createAgentProtocolHandler(() => (service as any)[kResolvedAgentProvider](), async () => undefined)
      const ctx = {
        request: { method: 'POST', url: new URL(BUILTIN_AGENT_ENDPOINT), headers: { authorization: 'Bearer renderer-stale-key' }, body: '{}' },
        response: { headers: {} },
        handle: vi.fn(),
      } as unknown as import('~/app').Context
      await handler(ctx)
      const response = await fetch(ctx.request.url, { method: 'POST', headers: ctx.request.headers as Record<string, string>, body: '{}' })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ choices: [{ message: { content: 'mock reply' } }] })
      expect(seen).toEqual([{ path: '/v1/chat/completions', authorization: 'Bearer local-test-key' }])
      await service.setProviderSettings({ endpoint, model: 'mock', apiKey: '' })
      expect(await (service as any)[kResolvedAgentProvider]()).toEqual({ mode: 'unconfigured' })
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
})
