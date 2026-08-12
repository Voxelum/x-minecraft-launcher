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