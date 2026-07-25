import type { ConnectionUserInfo, MultiplayerRoomAdmission } from '@xmcl/runtime-api'
import { describe, expect, it, vi } from 'vitest'
import type { Peers } from './peers'
import { MultiplayerRoom, type MultiplayerRoomApi } from './peerGorup'

class FakeSocket {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  sent: string[] = []

  open() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }

  receive(message: unknown) {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify(message),
      }),
    )
  }

  send(message: string) {
    this.sent.push(message)
  }

  close(code = 1000, reason = '') {
    this.readyState = 3
    this.onclose?.({ code, reason } as CloseEvent)
  }
}

const profile: ConnectionUserInfo = {
  id: 'minecraft-profile',
  name: 'Steve',
  avatar: '',
  textures: {
    SKIN: { url: '' },
  },
}

function admission(role: 'host' | 'guest'): MultiplayerRoomAdmission {
  return {
    roomId: 'room-1',
    socketUrl: 'wss://api.example/v2/multiplayer/rooms/room-1/socket',
    ticket: `${role}-ticket`,
    peerId: `${role}-peer`,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    role,
  }
}

describe('MultiplayerRoom', () => {
  it('lets the host initiate only toward an admitted guest', async () => {
    const socket = new FakeSocket()
    const initiate = vi.fn()
    const room = new MultiplayerRoom(
      admission('host'),
      'local-id',
      profile,
      { get: vi.fn() } as unknown as Peers,
      initiate,
      vi.fn(),
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
      () => socket,
    )

    const connecting = room.connect()
    socket.open()
    await connecting
    socket.receive({
      type: 'join-request',
      guest: {
        peerId: 'guest-peer',
        accountId: 'guest-account',
        displayName: 'Alex',
      },
      revision: 2,
    })

    expect(initiate).toHaveBeenCalledWith({
      remoteId: 'guest-peer',
      initiate: true,
    })
  })

  it('closes guest signaling after rtc-ready without restoring it', async () => {
    const socket = new FakeSocket()
    const api: MultiplayerRoomApi = {
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      closeRoom: vi.fn(),
      getIceServerCredential: vi.fn(),
    }
    const peer = {
      id: 'session',
      isDataChannelEstablished: () => true,
    }
    const room = new MultiplayerRoom(
      admission('guest'),
      'local-id',
      profile,
      { get: vi.fn(() => peer) } as unknown as Peers,
      vi.fn(),
      vi.fn(),
      api,
      () => socket,
    )

    const connecting = room.connect()
    socket.open()
    await connecting
    room.markConnected('host-peer')
    expect(JSON.parse(socket.sent[0])).toEqual({ type: 'rtc-ready' })
    socket.receive({ type: 'rtc-ready', revision: 3 })
    socket.close(1000, 'Signaling complete')

    expect(api.joinRoom).not.toHaveBeenCalled()
  })

  it('rejects a signaling socket that closes before the upgrade opens', async () => {
    const socket = new FakeSocket()
    const room = new MultiplayerRoom(
      admission('guest'),
      'local-id',
      profile,
      { get: vi.fn() } as unknown as Peers,
      vi.fn(),
      vi.fn(),
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
      () => socket,
    )

    const connecting = room.connect()
    socket.close(401, 'Unauthorized')

    await expect(connecting).rejects.toThrow('multiplayer_room_websocket_closed_before_open:401')
  })
})
