import { describe, expect, test, vi } from 'vitest'
import { LauncherProtocolHandler } from './LauncherProtocolHandler'

describe('LauncherProtocolHandler', () => {
  test('can skip remaining interceptors while preserving the final sink', async () => {
    const protocol = new LauncherProtocolHandler()
    const controller = new AbortController()
    const skipped = vi.fn()
    const sink = vi.fn(({ request, response }) => {
      response.status = 200
      response.body = request.url.toString()
    })

    protocol.registerHandler('https', ({ request }) => {
      request.url = new URL('http://provider.example/v1/chat/completions')
      request.skipRemainingHandlers = true
    })
    protocol.registerHandler('https', skipped)
    protocol.registerHandler('http', sink, true)

    const response = await protocol.handle({ url: 'https://ai.xmcl.app/v1/chat/completions', signal: controller.signal })

    expect(skipped).not.toHaveBeenCalled()
    expect(sink).toHaveBeenCalledOnce()
    expect(sink.mock.calls[0][0].request.signal).toBe(controller.signal)
    expect(response).toMatchObject({
      status: 200,
      body: 'http://provider.example/v1/chat/completions',
    })
  })

  test('preserves the fetch cache mode through protocol interceptors', async () => {
    const protocol = new LauncherProtocolHandler()
    const sink = vi.fn(({ request, response }) => {
      response.status = 200
      response.body = request.cache
    })
    protocol.registerHandler('https', sink, true)

    const response = await protocol.handle({
      url: 'https://api.xmcl.app/translation',
      cache: 'force-cache',
    })

    expect(sink).toHaveBeenCalledOnce()
    expect(response.body).toBe('force-cache')
  })

  test('does not run remaining interceptors or the sink after a response is handled', async () => {
    const protocol = new LauncherProtocolHandler()
    const skipped = vi.fn()
    const sink = vi.fn()
    protocol.registerHandler('https', ({ response }) => {
      response.status = 401
      response.body = 'Unauthorized'
      response.handled = true
    })
    protocol.registerHandler('https', skipped)
    protocol.registerHandler('https', sink, true)

    const response = await protocol.handle({ url: 'https://ai.xmcl.app/v1/chat/completions' })

    expect(skipped).not.toHaveBeenCalled()
    expect(sink).not.toHaveBeenCalled()
    expect(response).toMatchObject({ status: 401, body: 'Unauthorized' })
  })
})