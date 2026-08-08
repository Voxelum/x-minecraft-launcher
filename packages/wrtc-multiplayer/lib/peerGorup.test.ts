import {
  createPromiseSignal,
  type ConnectionUserInfo,
  type MultiplayerRoomAdmission,
  type MultiplayerRoomMember,
  type MultiplayerRoomState,
} from '@xmcl/runtime-api'
import { describe, expect, it, vi } from 'vitest'
import type { InitiateOptions, Peers } from './peers'
import {
  createPeerGroup,
  dropPeerConnection,
  MultiplayerRoom,
  type MultiplayerRoomApi,
} from './peerGorup'

class FakeSocket {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  sent: string[] = []
  closedWith: { code: number; reason: string } | undefined

  open() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }

  receive(message: unknown) {
    this.receiveRaw(JSON.stringify(message))
  }

  receiveRaw(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }

  send(message: string) {
    this.sent.push(message)
  }

  close(code = 1000, reason = '') {
    this.readyState = 3
    this.closedWith = { code, reason }
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

function admission(role: 'master' | 'member', peerId = `${role}-peer`): MultiplayerRoomAdmission {
  return {
    roomId: 'room-1',
    socketUrl: 'wss://signaling.example/v1/multiplayer/rooms/room-1/socket',
    ticket: `${role}-ticket`,
    peerId,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    role,
    maxPeers: 8,
  }
}

function member(
  peerId: string,
  status: 'negotiating' | 'connected' = 'connected',
): MultiplayerRoomMember {
  return {
    peerId,
    accountId: `${peerId}-account`,
    displayName: peerId,
    status,
    joinedAt: 1_754_352_000_000,
  }
}

function snapshot(
  selfPeerId: string,
  masterPeerId: string,
  members: MultiplayerRoomMember[],
  revision: number,
  status: MultiplayerRoomState['status'] = 'open',
): { type: 'room-state' } & MultiplayerRoomState {
  return {
    type: 'room-state',
    selfPeerId,
    masterPeerId,
    members,
    status,
    maxPeers: 8,
    revision,
  }
}

function roomApi(overrides: Partial<MultiplayerRoomApi> = {}): MultiplayerRoomApi {
  return {
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    closeRoom: vi.fn().mockResolvedValue(undefined),
    getIceServerCredential: vi.fn(),
    ...overrides,
  }
}

function emptyPeers(): Peers {
  return {
    get: vi.fn(),
    get entries() {
      return []
    },
    remove: vi.fn(),
  } as unknown as Peers
}

async function connectRoom(
  role: 'master' | 'member',
  options: {
    peerId?: string
    peers?: Peers
    initiate?: (options: InitiateOptions) => void
    applyRemoteDescription?: (
      description: {
        session: string
        id: string
        sdp: string
        candidates: Array<{ candidate: string; mid: string }>
      },
      type: 'offer' | 'answer',
      target?: RTCIceServer,
      all?: RTCIceServer[],
    ) => string
    api?: MultiplayerRoomApi
    socket?: FakeSocket
    onSharedTurnServer?: (server: RTCIceServer) => void
  } = {},
) {
  const socket = options.socket ?? new FakeSocket()
  const room = new MultiplayerRoom(
    admission(role, options.peerId),
    'local-id',
    profile,
    options.peers ?? emptyPeers(),
    options.initiate ?? vi.fn(),
    options.applyRemoteDescription ?? vi.fn(),
    options.api ?? roomApi(),
    options.onSharedTurnServer ?? vi.fn(),
    () => socket,
  )
  const connecting = room.connect()
  socket.open()
  await connecting
  return { room, socket }
}

describe('MultiplayerRoom', () => {
  it('uses strict room snapshots as the only topology authority', async () => {
    const sessions = new Map<string, any>()
    const peers = {
      get: vi.fn((id: string) =>
        [...sessions.values()].find((session) => session.id === id || session.remoteId === id),
      ),
      get entries() {
        return [...sessions.values()]
      },
      remove: vi.fn((id: string) => sessions.delete(id)),
    } as unknown as Peers
    const initiate = vi.fn(({ remoteId }: { remoteId?: string }) => {
      if (remoteId) {
        sessions.set(remoteId, { id: remoteId, remoteId, close: vi.fn() })
      }
    })
    const { room, socket } = await connectRoom('master', { peers, initiate })
    const onroomstate = vi.fn()
    room.onroomstate = onroomstate
    const members = [member('master-peer'), member('member-a', 'negotiating'), member('member-b')]

    socket.receive(snapshot('master-peer', 'master-peer', members, 1))
    socket.receive(snapshot('master-peer', 'master-peer', members, 1))
    socket.receive(snapshot('master-peer', 'master-peer', members, 2))
    const removedPeer = sessions.get('member-a')
    socket.receive(
      snapshot('master-peer', 'master-peer', [member('master-peer'), member('member-b')], 3),
    )

    expect(initiate).toHaveBeenCalledTimes(2)
    expect(initiate).toHaveBeenCalledWith({ remoteId: 'member-a', initiate: true })
    expect(initiate).toHaveBeenCalledWith({ remoteId: 'member-b', initiate: true })
    expect(onroomstate).toHaveBeenLastCalledWith({
      selfPeerId: 'master-peer',
      masterPeerId: 'master-peer',
      members: [member('master-peer'), member('member-b')],
      status: 'open',
      maxPeers: 8,
      revision: 3,
    })
    expect(removedPeer.close).toHaveBeenCalledOnce()
    expect(room.role).toBe('master')
  })

  it('never lets a member initiate room links and ignores non-master signals', async () => {
    const initiate = vi.fn()
    const applyRemoteDescription = vi.fn()
    const { room, socket } = await connectRoom('member', { initiate, applyRemoteDescription })
    socket.receive(
      snapshot(
        'member-peer',
        'master-peer',
        [member('master-peer'), member('member-peer'), member('other-member')],
        1,
      ),
    )

    socket.receive({
      type: 'signal',
      sender: 'other-member',
      payload: {
        sdp: 'offer',
        sdpType: 'offer',
        session: 'other-session',
        candidates: [],
      },
    })
    socket.receive({
      type: 'signal',
      sender: 'master-peer',
      payload: {
        sdp: 'offer',
        sdpType: 'offer',
        session: 'master-session',
        candidates: [],
      },
    })

    expect(initiate).not.toHaveBeenCalled()
    expect(applyRemoteDescription).toHaveBeenCalledOnce()
    expect(applyRemoteDescription).toHaveBeenCalledWith(
      {
        id: 'master-peer',
        session: 'master-session',
        sdp: 'offer',
        candidates: [],
      },
      'offer',
      undefined,
    )
  })

  it('keeps a negotiating member in the connecting state', async () => {
    const { room, socket } = await connectRoom('member')
    const onstate = vi.fn()
    room.onstate = onstate

    socket.receive(
      snapshot(
        'member-peer',
        'master-peer',
        [member('master-peer'), member('member-peer', 'negotiating')],
        1,
      ),
    )

    expect(onstate).toHaveBeenLastCalledWith('connecting')
  })

  it('accepts an empty candidate mid from the local connection representation', async () => {
    const applyRemoteDescription = vi.fn()
    const { socket } = await connectRoom('member', { applyRemoteDescription })
    socket.receive(
      snapshot('member-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )

    socket.receive({
      type: 'signal',
      sender: 'master-peer',
      payload: {
        sdp: 'offer',
        sdpType: 'offer',
        session: 'master-session',
        candidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 25565 typ host', mid: '' }],
      },
    })

    expect(applyRemoteDescription).toHaveBeenCalledWith(
      expect.objectContaining({
        candidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 25565 typ host', mid: '' }],
      }),
      'offer',
      undefined,
    )
  })

  it('closes removed peers and rebuilds all links after a master change or wait', async () => {
    const sessions = new Map<string, any>()
    const peers = {
      get: vi.fn((id: string) =>
        [...sessions.values()].find((session) => session.id === id || session.remoteId === id),
      ),
      get entries() {
        return [...sessions.values()]
      },
      remove: vi.fn((id: string) => sessions.delete(id)),
    } as unknown as Peers
    const initiate = vi.fn(({ remoteId }: { remoteId?: string }) => {
      if (remoteId) sessions.set(remoteId, { id: remoteId, remoteId, close: vi.fn() })
    })
    const { room, socket } = await connectRoom('member', { peers, initiate })
    socket.receive(
      snapshot('member-peer', 'old-master', [member('old-master'), member('member-peer')], 1),
    )
    sessions.set('old-master-session', {
      id: 'old-master-session',
      remoteId: 'old-master',
      close: vi.fn(),
    })
    socket.receive({
      type: 'signal',
      sender: 'old-master',
      payload: {
        sdp: 'offer',
        sdpType: 'offer',
        session: 'old-master-session',
        candidates: [],
      },
    })
    const oldMaster = sessions.get('old-master-session')

    socket.receive(
      snapshot(
        'member-peer',
        'member-peer',
        [member('old-master'), member('member-peer'), member('new-member')],
        2,
      ),
    )
    expect(oldMaster.close).toHaveBeenCalledOnce()
    expect(oldMaster.close).toHaveBeenCalledOnce()
    expect(initiate).toHaveBeenCalledTimes(2)
    expect(initiate).toHaveBeenCalledWith({ remoteId: 'old-master', initiate: true })
    expect(initiate).toHaveBeenCalledWith({ remoteId: 'new-member', initiate: true })
    expect(room.role).toBe('master')

    const rebuilt = [...sessions.values()].filter((session) => session.remoteId)
    socket.receive(
      snapshot(
        'member-peer',
        'member-peer',
        [member('old-master'), member('member-peer'), member('new-member')],
        3,
        'waiting-master',
      ),
    )
    for (const peer of rebuilt) expect(peer.close).toHaveBeenCalled()
  })

  it('ignores stale snapshots', async () => {
    const { room, socket } = await connectRoom('member')
    const onroomstate = vi.fn()
    room.onroomstate = onroomstate
    socket.receive(
      snapshot('member-peer', 'master-peer', [member('master-peer'), member('member-peer')], 3),
    )
    socket.receive(
      snapshot('member-peer', 'member-peer', [member('member-peer'), member('master-peer')], 2),
    )

    expect(onroomstate).toHaveBeenCalledOnce()
    expect(room.role).toBe('member')
  })

  it('rejects a snapshot self id mismatch before changing topology', async () => {
    const initiate = vi.fn()
    const { room, socket } = await connectRoom('member', { initiate })
    const onerror = vi.fn()
    room.onerror = onerror

    socket.receive(
      snapshot('other-peer', 'other-peer', [member('other-peer'), member('member-peer')], 1),
    )

    expect(socket.closedWith).toEqual({ code: 1002, reason: 'Protocol error' })
    expect(initiate).not.toHaveBeenCalled()
    expect(room.role).toBe('member')
    expect(onerror).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('self_peer_id_mismatch') }),
    )
  })

  it('handles a closed snapshot as a normal terminal state', async () => {
    const peer = {
      id: 'master-session',
      remoteId: 'master-peer',
      close: vi.fn(),
    }
    const peers = {
      get: vi.fn((id: string) => (id === peer.id || id === peer.remoteId ? peer : undefined)),
      get entries() {
        return [peer]
      },
      remove: vi.fn(),
    } as unknown as Peers
    const api = roomApi({ joinRoom: vi.fn() })
    const { room, socket } = await connectRoom('member', { peers, api })
    const onreset = vi.fn()
    const onerror = vi.fn()
    room.onreset = onreset
    room.onerror = onerror
    socket.receive(
      snapshot('member-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )

    socket.receive(
      snapshot(
        'member-peer',
        'master-peer',
        [member('master-peer'), member('member-peer')],
        2,
        'closed',
      ),
    )

    expect(peer.close).toHaveBeenCalledOnce()
    expect(peers.remove).toHaveBeenCalledWith('master-session')
    expect(socket.closedWith).toEqual({ code: 1000, reason: 'Room closed' })
    expect(onreset).toHaveBeenCalledOnce()
    expect(onerror).not.toHaveBeenCalled()
    expect(api.joinRoom).not.toHaveBeenCalled()
  })

  it.each([
    ['unknown message', { type: 'host-ready' }],
    [
      'member role field',
      {
        type: 'room-state',
        selfPeerId: 'member-peer',
        masterPeerId: 'master-peer',
        members: [member('master-peer'), { ...member('member-peer'), role: 'member' }],
        status: 'open',
        maxPeers: 8,
        revision: 1,
      },
    ],
    ['malformed signal', { type: 'signal', sender: 'master-peer', payload: { sdp: 'offer' } }],
    [
      'non-TURN shared server',
      {
        type: 'signal',
        sender: 'master-peer',
        payload: {
          sdp: 'offer',
          sdpType: 'offer',
          session: 'master-session',
          candidates: [],
          sharedTurnServer: {
            urls: 'stun:untrusted.example',
            username: 'user',
            credential: 'password',
          },
        },
      },
    ],
  ])('treats %s as a protocol failure', async (_name, message) => {
    const { room, socket } = await connectRoom('member')
    const onerror = vi.fn()
    const onreset = vi.fn()
    room.onerror = onerror
    room.onreset = onreset

    socket.receive(message)

    expect(socket.closedWith).toEqual({ code: 1002, reason: 'Protocol error' })
    expect(onreset).toHaveBeenCalledOnce()
    expect(onerror).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('multiplayer_room_protocol_error'),
      }),
    )
  })

  it('treats invalid JSON and binary messages as protocol failures', async () => {
    const first = await connectRoom('member')
    first.socket.receiveRaw('{')
    expect(first.socket.closedWith?.code).toBe(1002)

    const second = await connectRoom('member')
    second.socket.receiveRaw(new Uint8Array([1]))
    expect(second.socket.closedWith?.code).toBe(1002)
  })

  it('keeps the signaling socket open while reporting RTC state transitions', async () => {
    const peer = {
      id: 'master-session',
      remoteId: 'master-peer',
      isDataChannelEstablished: () => true,
    }
    const peers = {
      get: vi.fn(() => peer),
      get entries() {
        return [peer]
      },
      remove: vi.fn(),
    } as unknown as Peers
    const { room, socket } = await connectRoom('member', { peers })
    socket.receive(
      snapshot('member-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )

    room.setRtcState('master-peer', 'connected')

    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      type: 'rtc-state',
      state: 'connected',
    })
    room.setRtcState('master-peer', 'negotiating')
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      type: 'rtc-state',
      state: 'negotiating',
    })
    expect(socket.readyState).toBe(1)
  })

  it('uses the canonical role-specific signal envelopes', async () => {
    const peer = { id: 'session' }
    const peers = {
      get: vi.fn(() => peer),
      get entries() {
        return []
      },
      remove: vi.fn(),
    } as unknown as Peers
    const master = await connectRoom('master', { peers })
    master.socket.receive(
      snapshot('master-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )
    await master.room.sendLocalDescription('member-peer', 'offer-sdp', 'offer', [], {
      urls: 'turn:premium.example.com',
      username: 'room-user',
      credential: 'room-password',
    })
    expect(JSON.parse(master.socket.sent.at(-1)!)).toEqual({
      type: 'signal',
      receiver: 'member-peer',
      payload: {
        sdp: 'offer-sdp',
        sdpType: 'offer',
        session: 'session',
        candidates: [],
        sharedTurnServer: {
          urls: 'turn:premium.example.com',
          username: 'room-user',
          credential: 'room-password',
        },
      },
    })

    const roomMember = await connectRoom('member', { peers })
    roomMember.socket.receive(
      snapshot('member-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )
    await roomMember.room.sendLocalDescription('master-peer', 'answer-sdp', 'answer', [], {
      urls: 'turn:premium.example.com',
      username: 'room-user',
      credential: 'room-password',
    })
    expect(JSON.parse(roomMember.socket.sent.at(-1)!)).toEqual({
      type: 'signal',
      payload: {
        sdp: 'answer-sdp',
        sdpType: 'answer',
        session: 'session',
        candidates: [],
        sharedTurnServer: {
          urls: 'turn:premium.example.com',
          username: 'room-user',
          credential: 'room-password',
        },
      },
    })
  })

  it('adds an authenticated peer shared TURN server to the room pool', async () => {
    const onSharedTurnServer = vi.fn()
    const applyRemoteDescription = vi.fn()
    const { socket } = await connectRoom('member', {
      onSharedTurnServer,
      applyRemoteDescription,
    })
    socket.receive(
      snapshot('member-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )
    const sharedTurnServer = {
      urls: 'turn:premium.example.com',
      username: 'premium-room-user',
      credential: 'premium-room-password',
    }

    socket.receive({
      type: 'signal',
      sender: 'master-peer',
      payload: {
        sdp: 'offer',
        sdpType: 'offer',
        session: 'master-session',
        candidates: [],
        sharedTurnServer,
      },
    })

    expect(onSharedTurnServer).toHaveBeenCalledWith(sharedTurnServer)
    expect(applyRemoteDescription).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'master-peer' }),
      'offer',
      sharedTurnServer,
    )
  })

  it('sends canonical remove-member and cleans up the removed peer', async () => {
    const peer = {
      id: 'member-session',
      remoteId: 'member-peer',
      close: vi.fn(),
    }
    const peers = {
      get: vi.fn(() => peer),
      get entries() {
        return [peer]
      },
      remove: vi.fn(),
    } as unknown as Peers
    const { room, socket } = await connectRoom('master', { peers })
    socket.receive(
      snapshot('master-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )

    room.removeMember('member-peer')

    expect(socket.sent.map((value) => JSON.parse(value))).toEqual([
      { type: 'remove-member', peerId: 'member-peer' },
    ])
    expect(peer.close).toHaveBeenCalledOnce()
    expect(peers.remove).toHaveBeenCalledWith('member-session')
  })

  it('waits for an authoritative snapshot before completing master transfer', async () => {
    const { room, socket } = await connectRoom('master')
    const members = [member('master-peer'), member('member-peer')]
    socket.receive(snapshot('master-peer', 'master-peer', members, 1))

    let settled = false
    const transferring = room.transferMaster('member-peer').then(() => {
      settled = true
    })
    await Promise.resolve()

    expect(settled).toBe(false)
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      type: 'transfer-master',
      peerId: 'member-peer',
    })

    socket.receive(snapshot('master-peer', 'member-peer', members, 2))
    await transferring
    expect(settled).toBe(true)
    expect(room.role).toBe('member')
  })

  it('rejects pending master transfer on server error and another request', async () => {
    const { room, socket } = await connectRoom('master')
    const members = [member('master-peer'), member('member-a'), member('member-b')]
    socket.receive(snapshot('master-peer', 'master-peer', members, 1))

    const first = room.transferMaster('member-a')
    await expect(room.transferMaster('member-b')).rejects.toThrow(
      'multiplayer_room_transfer_pending',
    )
    const firstRejected = expect(first).rejects.toThrow(
      'multiplayer_room_master_target_unavailable',
    )
    socket.receive({ type: 'error', code: 'master_target_unavailable' })

    await firstRejected
  })

  it('rejects pending master transfer on socket closure and timeout', async () => {
    const closed = await connectRoom('master')
    const members = [member('master-peer'), member('member-peer')]
    closed.socket.receive(snapshot('master-peer', 'master-peer', members, 1))
    const socketFailure = closed.room.transferMaster('member-peer')
    const socketRejected = expect(socketFailure).rejects.toThrow(
      'multiplayer_room_transfer_socket_closed:4000',
    )
    closed.socket.close(4000, 'Room closed')
    await socketRejected

    vi.useFakeTimers()
    try {
      const timedOut = await connectRoom('master')
      timedOut.socket.receive(snapshot('master-peer', 'master-peer', members, 1))
      const transfer = timedOut.room.transferMaster('member-peer')
      const timedOutRejection = expect(transfer).rejects.toThrow(
        'multiplayer_room_transfer_timeout',
      )
      await vi.advanceTimersByTimeAsync(10_000)
      await timedOutRejection
    } finally {
      vi.useRealTimers()
    }
  })

  it('drops member and manual peers locally without sending remove-member', async () => {
    const masterPeer = {
      id: 'master-session',
      remoteId: 'master-peer',
      close: vi.fn(),
    }
    const memberPeers = {
      get: vi.fn((id: string) =>
        id === masterPeer.id || id === masterPeer.remoteId ? masterPeer : undefined,
      ),
      get entries() {
        return [masterPeer]
      },
      remove: vi.fn(),
    } as unknown as Peers
    const memberRoom = await connectRoom('member', { peers: memberPeers })
    memberRoom.socket.receive(
      snapshot('member-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )

    dropPeerConnection(memberPeers, memberRoom.room, masterPeer.id)

    expect(masterPeer.close).toHaveBeenCalledOnce()
    expect(memberPeers.remove).toHaveBeenCalledWith(masterPeer.id)
    expect(memberRoom.socket.sent).toEqual([])

    const manualPeer = {
      id: 'manual-session',
      remoteId: 'manual-peer',
      close: vi.fn(),
    }
    const manualPeers = {
      get: vi.fn((id: string) =>
        id === manualPeer.id || id === manualPeer.remoteId ? manualPeer : undefined,
      ),
      get entries() {
        return [manualPeer]
      },
      remove: vi.fn(),
    } as unknown as Peers
    const masterRoom = await connectRoom('master', { peers: manualPeers })
    masterRoom.socket.receive(
      snapshot('master-peer', 'master-peer', [member('master-peer'), member('room-member')], 1),
    )

    dropPeerConnection(manualPeers, masterRoom.room, manualPeer.id)

    expect(manualPeer.close).toHaveBeenCalledOnce()
    expect(manualPeers.remove).toHaveBeenCalledWith(manualPeer.id)
    expect(masterRoom.socket.sent).toEqual([])
  })

  it('sends remove-member when the local master drops an actual room member', async () => {
    const roomPeer = {
      id: 'member-session',
      remoteId: 'member-peer',
      close: vi.fn(),
    }
    const peers = {
      get: vi.fn((id: string) =>
        id === roomPeer.id || id === roomPeer.remoteId ? roomPeer : undefined,
      ),
      get entries() {
        return [roomPeer]
      },
      remove: vi.fn(),
    } as unknown as Peers
    const { room, socket } = await connectRoom('master', { peers })
    socket.receive(
      snapshot('master-peer', 'master-peer', [member('master-peer'), member('member-peer')], 1),
    )

    dropPeerConnection(peers, room, roomPeer.id)

    expect(socket.sent.map((message) => JSON.parse(message))).toEqual([
      { type: 'remove-member', peerId: 'member-peer' },
    ])
    expect(roomPeer.close).toHaveBeenCalledOnce()
    expect(peers.remove).toHaveBeenCalledWith(roomPeer.id)
  })

  it('updates reconnect admission without publishing synthetic topology', async () => {
    const firstSocket = new FakeSocket()
    const restoredSocket = new FakeSocket()
    const sockets = [firstSocket, restoredSocket]
    const api = roomApi({
      joinRoom: vi.fn().mockResolvedValue(admission('master', 'promoted-peer')),
    })
    const room = new MultiplayerRoom(
      admission('member'),
      'local-id',
      profile,
      emptyPeers(),
      vi.fn(),
      vi.fn(),
      api,
      vi.fn(),
      () => sockets.shift()!,
    )
    const onroomstate = vi.fn()
    room.onroomstate = onroomstate
    const connecting = room.connect()
    firstSocket.open()
    await connecting
    firstSocket.receive(
      snapshot('member-peer', 'old-master', [member('old-master'), member('member-peer')], 1),
    )
    onroomstate.mockClear()

    firstSocket.close(1006, 'Network lost')
    await vi.waitFor(() => expect(api.joinRoom).toHaveBeenCalledOnce())
    expect(api.joinRoom).toHaveBeenCalledWith('room-1', 'Steve', false)
    await vi.waitFor(() => expect(room.role).toBe('master'))
    expect(onroomstate).not.toHaveBeenCalled()

    restoredSocket.open()
    restoredSocket.receive(
      snapshot(
        'promoted-peer',
        'promoted-peer',
        [member('old-master'), member('promoted-peer')],
        2,
      ),
    )
    expect(onroomstate).toHaveBeenCalledWith(
      expect.objectContaining({
        selfPeerId: 'promoted-peer',
        masterPeerId: 'promoted-peer',
      }),
    )
  })

  it('restores a persistent socket after a non-terminal close', async () => {
    const firstSocket = new FakeSocket()
    const restoredSocket = new FakeSocket()
    const sockets = [firstSocket, restoredSocket]
    const api = roomApi({
      joinRoom: vi.fn().mockResolvedValue(admission('member')),
    })

    const room = new MultiplayerRoom(
      admission('member'),
      'local-id',
      profile,
      emptyPeers(),
      vi.fn(),
      vi.fn(),
      api,
      vi.fn(),
      () => sockets.shift()!,
    )
    const connecting = room.connect()
    firstSocket.open()
    await connecting

    firstSocket.close(1000, 'Server rotation')
    await vi.waitFor(() => expect(api.joinRoom).toHaveBeenCalledOnce())
    expect(api.joinRoom).toHaveBeenCalledWith('room-1', 'Steve', false)
    restoredSocket.open()
    await vi.waitFor(() => expect(restoredSocket.readyState).toBe(1))
  })

  it('retries for the full master recovery window with bounded jitter', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    try {
      const firstSocket = new FakeSocket()
      const restoredSocket = new FakeSocket()
      const sockets = [firstSocket, restoredSocket]
      const joinRoom = vi
        .fn()
        .mockRejectedValueOnce(new Error('retry-1'))
        .mockRejectedValueOnce(new Error('retry-2'))
        .mockRejectedValueOnce(new Error('retry-3'))
        .mockRejectedValueOnce(new Error('retry-4'))
        .mockRejectedValueOnce(new Error('retry-5'))
        .mockRejectedValueOnce(new Error('retry-6'))
        .mockRejectedValueOnce(new Error('retry-7'))
        .mockRejectedValueOnce(new Error('retry-8'))
        .mockResolvedValue(admission('member', 'restored-member'))
      const room = new MultiplayerRoom(
        admission('member'),
        'local-id',
        profile,
        emptyPeers(),
        vi.fn(),
        vi.fn(),
        roomApi({ joinRoom }),
        vi.fn(),
        () => sockets.shift()!,
      )
      const connecting = room.connect()
      firstSocket.open()
      await connecting

      firstSocket.close(1006, 'Network lost')
      await vi.advanceTimersByTimeAsync(27_500)
      expect(joinRoom).toHaveBeenCalledTimes(9)
      restoredSocket.open()
      expect(restoredSocket.readyState).toBe(1)
    } finally {
      vi.restoreAllMocks()
      vi.useRealTimers()
    }
  })

  it('finalizes terminal closes and settles intentional cancellation', async () => {
    const terminalSocket = new FakeSocket()
    const api = roomApi()
    const terminal = new MultiplayerRoom(
      admission('member'),
      'local-id',
      profile,
      emptyPeers(),
      vi.fn(),
      vi.fn(),
      api,
      vi.fn(),
      () => terminalSocket,
    )
    const onreset = vi.fn()
    terminal.onreset = onreset
    const connecting = terminal.connect()
    terminalSocket.open()
    await connecting
    terminalSocket.close(4003, 'Removed by master')
    expect(onreset).toHaveBeenCalledOnce()
    expect(api.joinRoom).not.toHaveBeenCalled()

    const supersededSocket = new FakeSocket()
    const superseded = new MultiplayerRoom(
      admission('member'),
      'local-id',
      profile,
      emptyPeers(),
      vi.fn(),
      vi.fn(),
      api,
      vi.fn(),
      () => supersededSocket,
    )
    const supersededConnecting = superseded.connect()
    supersededSocket.open()
    await supersededConnecting
    supersededSocket.close(4001, 'Session superseded')
    expect(api.joinRoom).not.toHaveBeenCalled()

    const pendingSocket = new FakeSocket()
    const pending = new MultiplayerRoom(
      admission('member'),
      'local-id',
      profile,
      emptyPeers(),
      vi.fn(),
      vi.fn(),
      roomApi(),
      vi.fn(),
      () => pendingSocket,
    )
    const pendingConnect = pending.connect()
    await pending.quit()
    await expect(pendingConnect).resolves.toBeUndefined()
  })
})

describe('createPeerGroup', () => {
  it('has explicit create/join APIs and rejects empty join ids', async () => {
    const signal = createPromiseSignal<string>()
    signal.resolve('local-id')
    const api = roomApi()
    const group = createPeerGroup(signal, emptyPeers(), () => profile, vi.fn(), vi.fn(), api)

    await expect(group.joinGroup('  ')).rejects.toThrow('multiplayer_room_id_required')
    expect(api.joinRoom).not.toHaveBeenCalled()
  })

  it('cancels an in-flight room creation without exposing the admission', async () => {
    const signal = createPromiseSignal<string>()
    signal.resolve('local-id')
    let resolveAdmission: (value: MultiplayerRoomAdmission) => void = () => {}
    const pendingAdmission = new Promise<MultiplayerRoomAdmission>((resolve) => {
      resolveAdmission = resolve
    })
    const api = roomApi({
      createRoom: vi.fn(() => pendingAdmission),
      closeRoom: vi.fn(),
    })
    const onjoin = vi.fn()
    const group = createPeerGroup(
      signal,
      emptyPeers(),
      () => profile,
      vi.fn(),
      vi.fn(),
      api,
      vi.fn(),
      vi.fn(),
      onjoin,
    )

    const creating = group.createGroup()
    await vi.waitFor(() => expect(api.createRoom).toHaveBeenCalledWith('Steve', 8))
    await group.leaveGroup()
    resolveAdmission(admission('master'))
    await creating

    expect(onjoin).not.toHaveBeenCalled()
    expect(api.closeRoom).toHaveBeenCalledWith('room-1')
    expect(group.getGroup()).toBeUndefined()
  })

  it('awaits transfer confirmation before leave evaluates the local role', async () => {
    const signal = createPromiseSignal<string>()
    signal.resolve('local-id')
    const socket = new FakeSocket()
    const api = roomApi({
      createRoom: vi.fn().mockResolvedValue(admission('master')),
      closeRoom: vi.fn().mockResolvedValue(undefined),
    })
    vi.stubGlobal(
      'WebSocket',
      vi.fn(function () {
        return socket
      }),
    )
    try {
      const group = createPeerGroup(signal, emptyPeers(), () => profile, vi.fn(), vi.fn(), api)
      const creating = group.createGroup()
      await vi.waitFor(() => expect(socket.onopen).not.toBeNull())
      socket.open()
      await creating
      const members = [member('master-peer'), member('member-peer')]
      socket.receive(snapshot('master-peer', 'master-peer', members, 1))

      let settled = false
      const transferring = group.transferGroupMaster('member-peer').then(() => {
        settled = true
      })
      await Promise.resolve()
      expect(settled).toBe(false)

      socket.receive(snapshot('master-peer', 'member-peer', members, 2))
      await transferring
      await group.leaveGroup()

      expect(api.closeRoom).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('clears the active room after a terminal snapshot', async () => {
    const signal = createPromiseSignal<string>()
    signal.resolve('local-id')
    const socket = new FakeSocket()
    const api = roomApi({
      joinRoom: vi.fn().mockResolvedValue(admission('member')),
    })
    vi.stubGlobal(
      'WebSocket',
      vi.fn(function () {
        return socket
      }),
    )
    try {
      const group = createPeerGroup(signal, emptyPeers(), () => profile, vi.fn(), vi.fn(), api)
      const joining = group.joinGroup('room-1')
      await vi.waitFor(() => expect(socket.onopen).not.toBeNull())
      socket.open()
      await joining
      expect(api.joinRoom).toHaveBeenCalledWith('room-1', 'Steve', true)

      socket.receive({
        ...snapshot(
          'member-peer',
          'master-peer',
          [member('master-peer'), member('member-peer', 'connected')],
          1,
        ),
        status: 'closed',
      })

      expect(group.getGroup()).toBeUndefined()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
