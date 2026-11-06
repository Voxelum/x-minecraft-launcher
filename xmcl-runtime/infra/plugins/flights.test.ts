import { describe, expect, it, vi } from 'vitest'
import { pluginFlights } from './flights'

function createApp() {
  const handlers: Array<(context: any) => void> = []
  const register = vi.fn()
  const app = {
    protocol: { registerHandler: vi.fn((_scheme, handler) => handlers.push(handler)) },
    registry: { register },
  }
  return { app, handlers, register }
}

describe('Vardrynn flights', () => {
  it('serves only local defaults without fetching or reading persisted XMCL flags', async () => {
    const { app, handlers, register } = createApp()
    pluginFlights(app as any, {} as any)
    expect(register).toHaveBeenCalledWith(expect.anything(), {})
    const response = { headers: {} as Record<string, string>, status: 0, body: '', handled: false }
    handlers[0]({ request: { url: new URL('http://launcher/flights') }, response })
    expect(response).toMatchObject({ status: 200, body: 'window.flights = {}', handled: true })
  })
})
