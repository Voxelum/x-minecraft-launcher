import { describe, expect, test, vi } from 'vitest'

const keys = vi.hoisted(() => ({
  flights: Symbol('kFlights'),
  accountService: Symbol('XmclAccountService'),
  authorization: Symbol('kXmclSessionAuthorization'),
}))

vi.mock('~/infra', () => ({ kFlights: keys.flights }))
vi.mock('~/xmclAccount/XmclAccountService', () => ({
  XmclAccountService: keys.accountService,
  kXmclSessionAuthorization: keys.authorization,
}))

const { pluginApiFallback } = await import('./pluginApiFallback')

function createPlugin(resolveAuthorization: () => Promise<unknown>) {
  const service = {
    [keys.authorization]: resolveAuthorization,
  }
  const app = {
    registry: {
      get: vi.fn(async (key: symbol) => (key === keys.flights ? {} : service)),
    },
    protocol: {
      registerHandler: vi.fn(),
    },
  }
  pluginApiFallback(app as any, {} as any)
  return {
    app,
    handler: app.protocol.registerHandler.mock.calls[0]![1],
  }
}

describe('pluginApiFallback', () => {
  test('strips renderer authorization before lookup and applies generated DPoP headers', async () => {
    const headers: Record<string, string> = {
      Authorization: 'renderer-token',
      DPoP: 'renderer-proof',
    }
    const resolveAuthorization = vi.fn(async () => {
      expect(headers).toEqual({})
      return {
        accessToken: 'xmcl-token',
        accountId: 'account-id',
        tokenType: 'DPoP',
        dpopProof: 'main-process-proof',
      }
    })
    const { handler } = createPlugin(resolveAuthorization)
    const request = {
      method: 'POST',
      url: new URL('https://signaling.xmcl.app/v1/rtc/official?room=1'),
      headers,
    }

    await handler({ request, response: {} })

    expect(headers).toEqual({
      Authorization: 'DPoP xmcl-token',
      DPoP: 'main-process-proof',
    })
  })

  test('does not restore renderer credentials when no session is available', async () => {
    const headers: Record<string, string> = {
      authorization: 'renderer-token',
      dpop: 'renderer-proof',
    }
    const { handler } = createPlugin(async () => undefined)
    const request = {
      method: 'GET',
      url: new URL('https://signaling.xmcl.app/v1/multiplayer/rooms'),
      headers,
    }

    await handler({ request, response: {} })

    expect(headers).toEqual({})
  })
})
