import { describe, expect, it, vi } from 'vitest'
import type { PeerConnectionFactory } from './PeerConnectionFactory'
import { createIceServersProvider, getIceServers } from './iceServers'

describe('getIceServers', () => {
  it('uses the authenticated built-in TURN credential provider', async () => {
    const credential = vi.fn(async () => ({
      stuns: ['stun.example:3478'],
      uris: ['turn:20.239.69.131'],
      username: 'user',
      password: 'password',
      ttl: 86_400,
      meta: {
        '20.239.69.131': 'hk',
      },
    }))

    const result = await getIceServers(credential)

    expect(credential).toHaveBeenCalledOnce()
    expect(result).toEqual({
      servers: [
        {
          urls: 'turn:20.239.69.131',
          username: 'user',
          credential: 'password',
        },
        {
          urls: 'stun:stun.example:3478',
        },
      ],
      meta: {
        '20.239.69.131': 'hk',
      },
    })
  })
})

describe('createIceServersProvider', () => {
  it('prioritizes room-shared TURN credentials and clears them on leave', () => {
    const provider = createIceServersProvider(
      {} as PeerConnectionFactory,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
    )
    const shared = {
      urls: 'turn:premium.example.com',
      username: 'room-user',
      credential: 'room-password',
    }

    provider.addSharedTurnServer(shared)
    expect(provider.get()).toEqual([[], [shared]])

    provider.clearSharedTurnServers()
    expect(provider.get()).toEqual([[], []])
  })
})
