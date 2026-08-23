import { AUTHORITY_DEV } from '@xmcl/runtime-api'
import { describe, expect, it, vi } from 'vitest'

const services = vi.hoisted(() => ({
  peer: Symbol('kPeerFacade'),
  UserService: class {},
}))

vi.mock('~/peer', () => ({ kPeerFacade: services.peer }))
vi.mock('~/user', () => ({ UserService: services.UserService }))

import { pluginYggdrasilHandler } from './pluginYggdrasilHandler'

describe('pluginYggdrasilHandler', () => {
  it('returns the resolved profile UUID from hasJoined username lookups', async () => {
    const profile = {
      id: '12345678-1234-1234-1234-123456789abc',
      name: 'reter',
      textures: {},
    }
    const app = {
      getLogger: vi.fn(() => ({ log: vi.fn() })),
      serverPort: Promise.resolve(25555),
      registry: {
        get: vi.fn(async () => ({
          state: {
            users: {
              offline: {
                authority: AUTHORITY_DEV,
                profiles: { [profile.id]: profile },
              },
            },
          },
        })),
      },
      protocol: { registerHandler: vi.fn() },
    }
    pluginYggdrasilHandler(app as any, {} as any)
    const handler = app.protocol.registerHandler.mock.calls[0]![1]
    const response: Record<string, any> = { headers: {} }

    await handler({
      request: {
        method: 'GET',
        url: new URL('xmcl://launcher/yggdrasil/sessionserver/session/minecraft/hasJoined?username=reter'),
        headers: {},
      },
      response,
      handle: vi.fn(),
    })

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toMatchObject({
      id: profile.id,
      name: profile.name,
    })
  })
})