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

function createServiceContext(flights: Record<string, unknown>) {
  const settings = {
    agentEndpoint: '',
    agentModel: '',
    agentProviderSet: vi.fn(),
  }
  return {
    app: {
      registry: {
        get: vi.fn()
          .mockResolvedValueOnce(settings)
          .mockResolvedValueOnce(flights),
      },
      secretStorage: {
        get: vi.fn().mockResolvedValue(''),
        put: vi.fn(),
      },
    },
    settings,
  }
}

describe('AgentService provider resolution', () => {
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
})