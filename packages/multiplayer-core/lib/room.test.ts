import type { ConnectionUserInfo, MultiplayerRoomAdmission } from '@xmcl/runtime-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTogetherRoomApi, TogetherRoom, type TogetherRoomCallbacks } from './room'

class FakeWebSocket {
  static readonly OPEN = 1
  static instances: FakeWebSocket[] = []

  readyState = 0
  sent: string[] = []
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor(readonly url: string | URL) {
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  receive(message: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }

  send(message: string) {
    this.sent.push(message)
  }

  close(code = 1000, reason = '') {
    this.readyState = 3
    this.onclose?.({ code, reason } as CloseEvent)
  }
}

const admission: MultiplayerRoomAdmission = {
  roomId: 'room',
  socketUrl: 'wss://example.test/room',
  ticket: 'ticket',
  peerId: 'self',
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  role: 'member',
  maxPeers: 8,
}

const profile: ConnectionUserInfo = {
  id: 'account',
  name: 'Player',
  avatar: '',
  textures: { SKIN: { url: '' } },
}

function member(peerId: string) {
  return {
    peerId,
    accountId: `account-${peerId}`,
    displayName: peerId,
    status: 'connected' as const,
    joinedAt: 1,
  }
}

function createCallbacks(): TogetherRoomCallbacks {
  return {
    initiate: vi.fn(),
    apply: vi.fn(),
    drop: vi.fn(),
    remap: vi.fn(),
    hasOpenMetadata: vi.fn(() => true),
    onState: vi.fn(),
    onRoomState: vi.fn(),
    onReset: vi.fn(),
    onError: vi.fn(),
    onPing: vi.fn(),
  }
}

afterEach(() => {
  FakeWebSocket.instances = []
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Together room', () => {
  it('initiates the master topology without dropping existing peers', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const callbacks = createCallbacks()
    const room = new TogetherRoom(
      admission,
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await connected
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'master',
      members: [member('self'), member('master'), member('other')],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'self',
      members: [member('self'), member('master'), member('other')],
      status: 'open',
      maxPeers: 8,
      revision: 2,
    })

    expect(callbacks.drop).not.toHaveBeenCalled()
    expect(callbacks.initiate).toHaveBeenCalledWith('master')
    expect(callbacks.initiate).toHaveBeenCalledWith('other')
  })

  it('preserves peers when the signaling socket is restored', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const masterAdmission = { ...admission, role: 'master' as const }
    const callbacks = createCallbacks()
    const socketAttempts: Array<{
      retry: number
      finish: ReturnType<typeof vi.fn>
    }> = []
    callbacks.onSocketAttempt = vi.fn((retry) => {
      const finish = vi.fn()
      socketAttempts.push({ retry, finish })
      return finish
    })
    const room = new TogetherRoom(
      masterAdmission,
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(async () => masterAdmission),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const firstSocket = FakeWebSocket.instances[0]
    firstSocket.open()
    await connected
    expect(socketAttempts).toHaveLength(1)
    expect(socketAttempts[0].retry).toBe(0)
    expect(socketAttempts[0].finish).toHaveBeenCalledWith('succeeded')
    const snapshot = {
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'self',
      members: [member('self'), member('other')],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    }
    firstSocket.receive(snapshot)
    expect(callbacks.initiate).toHaveBeenCalledTimes(1)

    firstSocket.close(1006, 'Network changed')
    expect(callbacks.drop).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(2))
    const restoredSocket = FakeWebSocket.instances[1]
    restoredSocket.open()
    await vi.waitFor(() => expect(restoredSocket.readyState).toBe(FakeWebSocket.OPEN))
    await vi.waitFor(() => expect(socketAttempts).toHaveLength(2))
    expect(socketAttempts[1].retry).toBe(1)
    expect(socketAttempts[1].finish).toHaveBeenCalledWith('succeeded')
    restoredSocket.receive(snapshot)

    expect(callbacks.drop).not.toHaveBeenCalled()
    expect(callbacks.initiate).toHaveBeenCalledTimes(2)
    expect(callbacks.initiate).toHaveBeenLastCalledWith('other')
  })

  it('cancels an in-flight signaling attempt when leaving the room', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const callbacks = createCallbacks()
    const finishAttempt = vi.fn()
    const closing = Promise.withResolvers<void>()
    callbacks.onSocketAttempt = vi.fn(() => finishAttempt)
    const room = new TogetherRoom(
      { ...admission, role: 'master' },
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(() => closing.promise),
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connecting = room.connect()
    const quitting = room.quit()

    await expect(connecting).rejects.toThrow('multiplayer_room_websocket_upgrade_cancelled')
    expect(finishAttempt).toHaveBeenCalledOnce()
    expect(finishAttempt).toHaveBeenCalledWith('cancelled', 'launcher_shutdown')
    closing.resolve()
    await quitting
  })

  it('remaps a rejoined member without dropping its existing peer', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const callbacks = createCallbacks()
    const room = new TogetherRoom(
      admission,
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await connected
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'master',
      members: [member('self'), member('master')],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'master-restored',
      members: [
        member('self'),
        { ...member('master-restored'), accountId: 'account-master' },
      ],
      status: 'open',
      maxPeers: 8,
      revision: 2,
    })

    expect(callbacks.remap).toHaveBeenCalledWith('master', 'master-restored')
    expect(callbacks.drop).not.toHaveBeenCalled()
  })

  it('keeps a removed peer during the reconnect grace period', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const callbacks = createCallbacks()
    const room = new TogetherRoom(
      admission,
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await connected
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'master',
      members: [member('self'), member('master')],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'self',
      members: [member('self')],
      status: 'open',
      maxPeers: 8,
      revision: 2,
    })
    expect(callbacks.drop).not.toHaveBeenCalled()

    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'master-restored',
      members: [
        member('self'),
        { ...member('master-restored'), accountId: 'account-master' },
      ],
      status: 'open',
      maxPeers: 8,
      revision: 3,
    })

    expect(callbacks.remap).toHaveBeenCalledWith('master', 'master-restored')
    expect(callbacks.drop).not.toHaveBeenCalled()
    await room.quit()
  })

  it('drops a member that does not return within the reconnect grace period', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const callbacks = createCallbacks()
    const room = new TogetherRoom(
      admission,
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await connected
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'master',
      members: [member('self'), member('master')],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'self',
      members: [member('self')],
      status: 'open',
      maxPeers: 8,
      revision: 2,
    })

    expect(callbacks.drop).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(15_000)
    expect(callbacks.drop).toHaveBeenCalledWith('master')
  })

  it('ignores a stale signal receiver after a member leaves', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const callbacks = createCallbacks()
    const room = new TogetherRoom(
      { ...admission, role: 'master' },
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(async () => {}),
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await connected
    socket.receive({ type: 'error', code: 'invalid_receiver' })

    expect(callbacks.onError).not.toHaveBeenCalled()
    await room.quit()
  })

  it('does not expose WebRTC state as the room state', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const callbacks = createCallbacks()
    const room = new TogetherRoom(
      admission,
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await connected
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'master',
      members: [member('self'), member('master')],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })

    expect(callbacks.onState).toHaveBeenCalledWith('connected')
    const stateCalls = callbacks.onState.mock.calls.length
    room.setRtcState('master', 'negotiating')
    room.setRtcState('master', 'connected')
    expect(callbacks.onState).toHaveBeenCalledTimes(stateCalls)
    await room.quit()
  })

  it('transfers ownership before the master leaves an occupied room', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const closeRoom = vi.fn()
    const callbacks = createCallbacks()
    const room = new TogetherRoom(
      { ...admission, role: 'master' },
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom,
        getIceServerCredential: vi.fn(),
      },
      callbacks,
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await connected
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'self',
      members: [member('self'), member('other')],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })

    const quitting = room.quit()
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      type: 'transfer-master',
      peerId: 'other',
    })
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'other',
      members: [member('self'), member('other')],
      status: 'open',
      maxPeers: 8,
      revision: 2,
    })
    await quitting

    expect(closeRoom).not.toHaveBeenCalled()
    expect(socket.readyState).toBe(3)
  })

  it('closes the room when the last member leaves', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const closeRoom = vi.fn(async () => {})
    const room = new TogetherRoom(
      { ...admission, role: 'master' },
      profile,
      {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom,
        getIceServerCredential: vi.fn(),
      },
      createCallbacks(),
      { emit: vi.fn() },
    )

    const connected = room.connect()
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await connected
    socket.receive({
      type: 'room-state',
      selfPeerId: 'self',
      masterPeerId: 'self',
      members: [member('self')],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })

    await room.quit()

    expect(closeRoom).toHaveBeenCalledWith('room')
  })
})

describe('Together room API', () => {
  it('normalizes admissions and uses authenticated requests', async () => {
    const response = {
      roomId: 'room',
      roomSessionId: '73fb5ca7-b8ec-4524-a115-9413d3b55ef9',
      socketUrl: '/v1/multiplayer/rooms/room/socket',
      ticket: 'ticket',
      peerId: 'self',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      role: 'master',
      maxPeers: 8,
    }
    const fetch = vi.fn(async () => new Response(JSON.stringify(response)))
    const api = createTogetherRoomApi({
      getBaseUrl: () => 'https://signaling.example.test/base',
      fetch,
    })

    await expect(api.createRoom('Player', 8)).resolves.toEqual({
      ...response,
      socketUrl: 'wss://signaling.example.test/v1/multiplayer/rooms/room/socket',
    })
    expect(fetch).toHaveBeenCalledWith(
      'https://signaling.example.test/v1/multiplayer/rooms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ displayName: 'Player', maxPeers: 8 }),
        credentials: 'include',
      }),
    )
  })
})