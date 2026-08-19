import type { ConnectionUserInfo, MultiplayerIceServerCredential, MultiplayerRoomAdmission } from '@xmcl/runtime-api'
import type { LocalLanServer, LocalNetwork, LocalServer } from './localNetwork'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MultiplayerLogEvent } from './logger'
import { createTogetherMultiplayer } from './multiplayer'

class FakeDataChannel {
  readonly readyState = 'open'
  readonly bufferedAmount = 0
  bufferedAmountLowThreshold = 0
  binaryType: BinaryType = 'arraybuffer'
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  onbufferedamountlow: (() => void) | null = null
  send = vi.fn()
  close = vi.fn()

  constructor(
    readonly label: string,
    readonly protocol: string,
  ) {}
}

class FakePeerConnection {
  static instance: FakePeerConnection
  static instances: FakePeerConnection[] = []

  readonly channels = new Map<string, FakeDataChannel>()
  get channel() {
    return this.channels.get('metadata')!
  }
  connectionState: RTCPeerConnectionState = 'new'
  iceConnectionState: RTCIceConnectionState = 'new'
  iceGatheringState: RTCIceGatheringState = 'new'
  signalingState: RTCSignalingState = 'stable'
  private readonly listeners = new Map<string, Set<() => void>>()

  constructor() {
    FakePeerConnection.instance = this
    FakePeerConnection.instances.push(this)
  }

  addEventListener(type: string, listener: () => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }
  emit(type: string) {
    for (const listener of this.listeners.get(type) ?? []) listener()
  }
  createDataChannel(label: string, options?: RTCDataChannelInit) {
    const channel = new FakeDataChannel(label, options?.protocol ?? '')
    this.channels.set(channel.protocol, channel)
    return channel as unknown as RTCDataChannel
  }
  async createOffer() {
    return { type: 'offer' as const, sdp: 'offer' }
  }
  async setLocalDescription() {
    this.signalingState = 'have-local-offer'
  }
  close = vi.fn()
}

class FakeWebSocket {
  static readonly OPEN = 1
  static instances: FakeWebSocket[] = []

  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null

  constructor() {
    FakeWebSocket.instances.push(this)
  }

  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  receive(message: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(message) }))
  }

  send() {}

  close(code = 1000, reason = '') {
    this.readyState = 3
    this.onclose?.({ code, reason } as CloseEvent)
  }
}

const profile: ConnectionUserInfo = {
  id: 'account',
  name: 'Player',
  avatar: '',
  textures: { SKIN: { url: '' } },
}

afterEach(() => {
  FakePeerConnection.instances = []
  FakeWebSocket.instances = []
  vi.unstubAllGlobals()
})

describe('Together multiplayer LAN discovery', () => {
  it('retries ICE credentials before creating a peer after the startup refresh fails', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const getIceServerCredential = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ stuns: ['stun.example.test'], ttl: 300 })
    const multiplayer = createTogetherMultiplayer({
      localNetwork: {
        connect: vi.fn(),
        listen: vi.fn(),
        discoverLan: vi.fn(async () => {}),
        broadcastLan: vi.fn(),
      },
      roomApi: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential,
      },
    })

    await multiplayer.start('local')
    await multiplayer.initiate()

    expect(getIceServerCredential).toHaveBeenCalledTimes(2)
  })

  it('starts and creates a manual peer while ICE credential refresh is pending', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const multiplayer = createTogetherMultiplayer({
      localNetwork: {
        connect: vi.fn(),
        listen: vi.fn(),
        discoverLan: vi.fn(async () => {}),
        broadcastLan: vi.fn(),
      },
      roomApi: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(() => new Promise<MultiplayerIceServerCredential>(() => {})),
      },
    })

    await expect(multiplayer.start('local')).resolves.toBeUndefined()
    await expect(multiplayer.initiate()).resolves.toEqual(expect.any(String))
  })

  it('waits for ICE credentials before creating peers when required by the provider', async () => {
    const credential = Promise.withResolvers<MultiplayerIceServerCredential>()
    const createPeerConnection = vi.fn(() => new FakePeerConnection() as unknown as RTCPeerConnection)
    const multiplayer = createTogetherMultiplayer({
      localNetwork: {
        connect: vi.fn(),
        listen: vi.fn(),
        discoverLan: vi.fn(async () => {}),
        broadcastLan: vi.fn(),
      },
      peerConnectionProvider: { createPeerConnection },
      waitForIceServersBeforePeer: true,
      roomApi: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(() => credential.promise),
      },
    })

    await multiplayer.start('local')
    const initiating = multiplayer.initiate()
    expect(createPeerConnection).not.toHaveBeenCalled()

    credential.resolve({ stuns: ['stun.example.test'], ttl: 300 })
    await initiating

    expect(createPeerConnection).toHaveBeenCalledWith({
      iceServers: [{ urls: ['stun:stun.example.test'] }],
      iceCandidatePoolSize: 8,
    })
  })

  it('preserves ICE URL schemes for network diagnostics', async () => {
    const validIceServerSet = vi.fn()
    const multiplayer = createTogetherMultiplayer({
      localNetwork: {
        connect: vi.fn(),
        listen: vi.fn(),
        discoverLan: vi.fn(async () => {}),
        broadcastLan: vi.fn(),
      },
      roomApi: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(async () => ({
          stuns: ['stun.example.test'],
          uris: ['turn.example.test'],
          username: 'user',
          password: 'password',
        })),
      },
    })
    multiplayer.setState({
      connections: [],
      exposedPorts: [],
      connectionClear: vi.fn(),
      validIceServerSet,
      turnserversSet: vi.fn(),
      subscribe: vi.fn(),
    } as any)

    await multiplayer.refreshIceServers()

    expect(validIceServerSet).toHaveBeenCalledWith([
      'stun:stun.example.test',
      'turn:turn.example.test',
    ])
  })

  it('publishes a manual connection token before ICE gathering completes', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const connectionLocalDescription = vi.fn()
    const connections: any[] = []
    const multiplayer = createTogetherMultiplayer({
      localNetwork: {
        connect: vi.fn(),
        listen: vi.fn(),
        discoverLan: vi.fn(async () => {}),
        broadcastLan: vi.fn(),
      },
      roomApi: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(async () => ({ stuns: [] })),
      },
    })
    multiplayer.setState({
      connections,
      exposedPorts: [],
      connectionClear: vi.fn(),
      connectionAdd: vi.fn((connection) => connections.push(connection)),
      connectionLocalDescription,
      validIceServerSet: vi.fn(),
      turnserversSet: vi.fn(),
      subscribe: vi.fn(),
    } as any)

    await multiplayer.start('local')
    await multiplayer.initiate()

    await vi.waitFor(() => expect(connectionLocalDescription).toHaveBeenCalledOnce())
    expect(connectionLocalDescription).toHaveBeenCalledWith({
      id: expect.any(String),
      description: expect.stringMatching(/^m1\./),
    })
    expect(FakePeerConnection.instance.iceGatheringState).not.toBe('complete')
  })

  it('does not clear connections when the same state object is rebound', () => {
    const connectionClear = vi.fn()
    const state = {
      connections: [],
      exposedPorts: [],
      connectionClear,
      subscribe: vi.fn(),
    } as any
    const multiplayer = createTogetherMultiplayer({
      localNetwork: {
        connect: vi.fn(),
        listen: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      roomApi: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(),
      },
    })

    multiplayer.setState(state)
    multiplayer.setState(state)

    expect(connectionClear).toHaveBeenCalledOnce()
    expect(state.subscribe).toHaveBeenCalledOnce()
  })

  it('forwards local worlds, rebroadcasts remote proxies, and suppresses proxy echoes', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    let onLanDiscover: ((server: LocalLanServer) => void) | undefined
    const proxyServer: LocalServer = {
      id: 'proxy',
      port: 30_000,
      close: vi.fn(),
      onConnection: vi.fn(),
    }
    const localNetwork: LocalNetwork = {
      connect: vi.fn(),
      listen: vi.fn(async () => proxyServer),
      discoverLan: vi.fn(async (listener) => {
        onLanDiscover = listener
      }),
      broadcastLan: vi.fn(async () => {}),
    }
    const multiplayer = createTogetherMultiplayer({
      localNetwork,
      roomApi: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(async () => ({ stuns: [] })),
      },
    })

    await multiplayer.start('local')
    await multiplayer.initiate()
    const channel = FakePeerConnection.instance.channel

    onLanDiscover?.({ motd: 'Local World', port: 25_565 })
    expect(channel.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'lan', payload: { port: 25_565, motd: 'Local World' } }),
    )

    channel.onmessage?.({
      data: JSON.stringify({ type: 'lan', payload: { port: 25_566, motd: 'Remote World' } }),
    } as MessageEvent)
    await vi.waitFor(() => {
      expect(localNetwork.broadcastLan).toHaveBeenCalledWith({
        motd: 'Remote World',
        port: 30_000,
      })
    })

    channel.send.mockClear()
    onLanDiscover?.({ motd: 'Remote World', port: 30_000 })
    expect(channel.send).not.toHaveBeenCalled()
  })

  it('creates a room peer when an unrelated connection has the same remote ID', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const events: MultiplayerLogEvent[] = []
    const admission: MultiplayerRoomAdmission = {
      roomId: 'room',
      socketUrl: 'wss://example.test/room',
      ticket: 'ticket',
      peerId: 'master',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      role: 'master',
      maxPeers: 8,
    }
    const multiplayer = createTogetherMultiplayer({
      localNetwork: {
        connect: vi.fn(),
        listen: vi.fn(),
        discoverLan: vi.fn(async () => {}),
        broadcastLan: vi.fn(),
      },
      roomApi: {
        createRoom: vi.fn(async () => admission),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(async () => ({ stuns: [] })),
      },
      logger: { emit: (event) => events.push(event) },
    })

    await multiplayer.start('local')
    await multiplayer.initiate()
    FakePeerConnection.instance.channel.onmessage?.({
      data: JSON.stringify({
        type: 'identity',
        payload: { peerId: 'member', profile },
      }),
    } as MessageEvent)

    const joining = multiplayer.createGroup()
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await joining
    socket.receive({
      type: 'room-state',
      selfPeerId: 'master',
      masterPeerId: 'master',
      members: [
        { peerId: 'master', accountId: 'master-account', displayName: 'Master', status: 'connected', joinedAt: 1 },
        { peerId: 'member', accountId: 'member-account', displayName: 'Member', status: 'negotiating', joinedAt: 2 },
      ],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })

    expect(FakePeerConnection.instances).toHaveLength(2)
    expect(events).toContainEqual({
      level: 'info',
      event: 'together.room.peer_created',
      data: expect.objectContaining({ remoteId: 'member' }),
    })
  })

  it('replaces a failed room peer while the local user is master', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    vi.stubGlobal('WebSocket', FakeWebSocket)
    const admission: MultiplayerRoomAdmission = {
      roomId: 'room',
      socketUrl: 'wss://example.test/room',
      ticket: 'ticket',
      peerId: 'master',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      role: 'master',
      maxPeers: 8,
    }
    const multiplayer = createTogetherMultiplayer({
      localNetwork: {
        connect: vi.fn(),
        listen: vi.fn(),
        discoverLan: vi.fn(async () => {}),
        broadcastLan: vi.fn(),
      },
      roomApi: {
        createRoom: vi.fn(async () => admission),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(async () => ({ stuns: [] })),
      },
    })

    await multiplayer.start('local')
    const joining = multiplayer.createGroup()
    await vi.waitFor(() => expect(FakeWebSocket.instances).toHaveLength(1))
    const socket = FakeWebSocket.instances[0]
    socket.open()
    await joining
    socket.receive({
      type: 'room-state',
      selfPeerId: 'master',
      masterPeerId: 'master',
      members: [
        { peerId: 'master', accountId: 'master-account', displayName: 'Master', status: 'connected', joinedAt: 1 },
        { peerId: 'member', accountId: 'member-account', displayName: 'Member', status: 'negotiating', joinedAt: 2 },
      ],
      status: 'open',
      maxPeers: 8,
      revision: 1,
    })
    await vi.waitFor(() => expect(FakePeerConnection.instances).toHaveLength(1))
    const failed = FakePeerConnection.instances[0]

    failed.connectionState = 'failed'
    failed.emit('connectionstatechange')

    expect(failed.close).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(FakePeerConnection.instances).toHaveLength(2))
  })

  it('releases renderer-owned resources when the transport is disposed', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const downloadServer: LocalServer = {
      id: 'download',
      port: 25_566,
      close: vi.fn(),
      onConnection: vi.fn(),
    }
    const stopLanDiscovery = vi.fn()
    const localNetwork: LocalNetwork = {
      connect: vi.fn(),
      listen: vi.fn(async () => downloadServer),
      discoverLan: vi.fn(async () => {}),
      stopLanDiscovery,
      broadcastLan: vi.fn(),
    }
    const sharedFiles = {
      share: vi.fn(async () => {}),
      open: vi.fn(),
    }
    const unsubscribe = vi.fn()
    const state = {
      connections: [],
      exposedPorts: [],
      connectionClear: vi.fn(),
      connectionAdd: vi.fn(),
      connectionDrop: vi.fn(),
      groupReset: vi.fn(),
      subscribe: vi.fn(),
      unsubscribe,
    } as any
    const multiplayer = createTogetherMultiplayer({
      localNetwork,
      sharedFiles,
      roomApi: {
        createRoom: vi.fn(),
        joinRoom: vi.fn(),
        closeRoom: vi.fn(),
        getIceServerCredential: vi.fn(async () => ({ stuns: [] })),
      },
    })
    multiplayer.setState(state)
    await multiplayer.start('local')
    await multiplayer.initiate()
    const discoveryListener = vi.mocked(localNetwork.discoverLan).mock.calls[0][0]
    const exposedPortsListener = state.subscribe.mock.calls[0][1]

    await multiplayer.dispose()

    expect(FakePeerConnection.instance.close).toHaveBeenCalledOnce()
    expect(downloadServer.close).toHaveBeenCalledOnce()
    expect(stopLanDiscovery).toHaveBeenCalledWith(discoveryListener)
    expect(sharedFiles.share).toHaveBeenLastCalledWith(undefined, [])
    expect(unsubscribe).toHaveBeenCalledWith('exposedPortsSet', exposedPortsListener)
    expect(state.connectionClear).toHaveBeenCalledTimes(2)
    expect(state.groupReset).toHaveBeenCalledOnce()
  })
})