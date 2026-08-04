import { describe, expect, test, vi } from 'vitest'
import { LauncherProtocolHandler } from './LauncherProtocolHandler'
import { pluginCommonProtocol } from './pluginCommonProtocol'

describe('common protocol', () => {
  test('forwards request cancellation to the network fetch', async () => {
    const protocol = new LauncherProtocolHandler()
    const fetch = vi.fn(async () => new Response('{}', { status: 200 }))
    pluginCommonProtocol({ protocol, fetch } as any, {} as any)
    const controller = new AbortController()

    await protocol.handle({
      url: 'https://provider.example/v1/chat/completions',
      method: 'POST',
      body: '{}',
      signal: controller.signal,
    })

    expect(fetch).toHaveBeenCalledWith('https://provider.example/v1/chat/completions', expect.objectContaining({
      signal: controller.signal,
    }))
  })
})
