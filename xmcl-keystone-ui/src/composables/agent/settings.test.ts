import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { AgentService, XmclAccountService } from '@xmcl/runtime-api'
import { createAgentSettings } from './settings'

vi.mock('../service', () => ({ useService: vi.fn() }))

const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.useRealTimers()
})

async function setup(endpoint = '') {
  vi.useFakeTimers()
  let saved = { endpoint, model: 'test-model', configured: false, mode: 'unconfigured' as const }
  const keys = new Map<string, string>()
  const service = {
    getProviderSettings: vi.fn(async () => saved),
    setProviderSettings: vi.fn(async (input: { endpoint: string; model: string; apiKey?: string }) => {
      if (input.endpoint) new URL(input.endpoint)
      if (input.apiKey !== undefined) keys.set(input.endpoint, input.apiKey)
      saved = { ...saved, endpoint: input.endpoint, model: input.model, configured: !!keys.get(input.endpoint) }
    }),
  }
  const scope = effectScope()
  scopes.push(scope)
  const settings = scope.run(() => createAgentSettings(service as unknown as AgentService, {} as XmclAccountService))!
  await settings.ready
  return { settings, service, keys }
}

describe('Agent URL and key editing', () => {
  it('never saves a pending A key to another custom host B', async () => {
    const { settings, keys } = await setup('https://a.test/v1')
    settings.updateApiKey('key-a')
    settings.endpoint.value = 'https://b.test/v1'
    expect(settings.apiKey.value).toBe('')
    await settings.flush()
    expect(keys.size).toBe(0)
  })

  it('keeps a key-first draft, reports missing URL, and recovers after URL entry', async () => {
    const { settings, keys } = await setup()
    settings.updateApiKey('draft-key')
    await expect(settings.flush()).rejects.toThrow('Enter an Agent URL')
    settings.endpoint.value = 'https://b.test/v1'
    await settings.flush()
    expect(keys.get('https://b.test/v1')).toBe('draft-key')
    expect(settings.error.value).toBe('')
  })

  it('serializes a slow A key write before the new B selection', async () => {
    const { settings, service, keys } = await setup('https://a.test/v1')
    const original = service.setProviderSettings.getMockImplementation()!
    let release!: () => void
    service.setProviderSettings.mockImplementationOnce(async input => {
      await new Promise<void>(resolve => { release = resolve })
      await original(input)
    })
    const saving = settings.setApiKey('key-a')
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    settings.endpoint.value = 'https://b.test/v1'
    const switching = settings.flush()
    release()
    await Promise.all([saving, switching])
    expect(keys.get('https://a.test/v1')).toBe('key-a')
    expect(keys.has('https://b.test/v1')).toBe(false)
    expect((await service.getProviderSettings()).endpoint).toBe('https://b.test/v1')
  })

  it('recovers from a rejected IPC write and clear cannot resurrect a pending key', async () => {
    const { settings, service, keys } = await setup('https://a.test/v1')
    service.setProviderSettings.mockRejectedValueOnce(new Error('keychain unavailable'))
    await expect(settings.setApiKey('key-a')).rejects.toThrow('keychain unavailable')
    await settings.flush()
    expect(settings.error.value).toBe('')
    settings.updateApiKey('replacement')
    await settings.clearApiKey()
    await vi.advanceTimersByTimeAsync(1000)
    expect(keys.get('https://a.test/v1')).toBe('')
  })

  it('does not refresh configured status from A while B is waiting for debounce', async () => {
    const { settings } = await setup('https://a.test/v1')
    await settings.setApiKey('key-a')
    settings.endpoint.value = 'https://b.test/v1'
    await settings.refreshStatus()
    expect(settings.configured.value).toBe(false)
    await settings.flush()
    expect(settings.configured.value).toBe(false)
  })

  it('keeps key-first draft through incomplete URL errors and saves after correction', async () => {
    const { settings, keys } = await setup()
    settings.updateApiKey('draft-key')
    settings.endpoint.value = 'http://'
    await expect(settings.flush()).rejects.toThrow()
    settings.endpoint.value = 'https://corrected.test/v1'
    expect(settings.apiKey.value).toBe('draft-key')
    await settings.flush()
    expect(keys.get('https://corrected.test/v1')).toBe('draft-key')
  })

  it('debounced rejection is displayed and a later edit retries without an unhandled rejection', async () => {
    const { settings, service } = await setup('https://a.test/v1')
    service.setProviderSettings.mockRejectedValueOnce(new Error('offline'))
    settings.updateApiKey('key-a')
    await vi.advanceTimersByTimeAsync(500)
    expect(settings.error.value).toBe('offline')
    settings.model.value = 'retry-model'
    await vi.advanceTimersByTimeAsync(500)
    expect(settings.error.value).toBe('')
    expect((await service.getProviderSettings()).configured).toBe(true)
  })

  it('preserves empty builtin settings without writing a key', async () => {
    const { settings, service, keys } = await setup()
    settings.model.value = ''
    await settings.flush()
    expect(service.setProviderSettings).toHaveBeenLastCalledWith({ endpoint: '', model: '' })
    expect(keys.size).toBe(0)
  })
})
