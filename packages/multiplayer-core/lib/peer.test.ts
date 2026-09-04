import type { ConnectionUserInfo, InstanceManifest } from '@xmcl/runtime-api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FileTransferChannel, type TransferWritable } from './fileTransfer'
import type { LocalServer, LocalSocket } from './localNetwork'
import type { MultiplayerLogEvent } from './logger'
import { TogetherPeer } from './peer'

class FakePeerConnection {
  static instance: FakePeerConnection
  private readonly listeners = new Map<string, Array<(event: any) => void>>()

  readonly setRemoteDescription = vi.fn(async (description: RTCSessionDescriptionInit) => {
    this.remoteDescription = { ...description, sdp: `normalized:${description.sdp}` } as RTCSessionDescription
    this.signalingState = 'stable'
  })
  readonly addIceCandidate = vi.fn(async () => {})
  readonly getStats = vi.fn(async () => new Map())
  readonly close = vi.fn()
  remoteDescription: RTCSessionDescription | null = null
  signalingState: RTCSignalingState = 'have-local-offer'
  connectionState: RTCPeerConnectionState = 'new'
  iceConnectionState: RTCIceConnectionState = 'new'
  iceGatheringState: RTCIceGatheringState = 'new'
  readonly sctp = { maxMessageSize: 1_024 } as RTCSctpTransport
  readonly channels = new Map<string, FakeDataChannel>()

  constructor() {
    FakePeerConnection.instance = this
  }

  addEventListener(type: string, listener: (event: any) => void) {
    const listeners = this.listeners.get(type) ?? []
    listeners.push(listener)
    this.listeners.set(type, listeners)
  }

  emit(type: string, event: any) {
    for (const listener of this.listeners.get(type) ?? []) listener(event)
  }

  createDataChannel(label: string, options?: RTCDataChannelInit) {
    const channel = new FakeDataChannel(label, options?.protocol ?? '')
    this.channels.set(channel.protocol, channel)
    return channel as unknown as RTCDataChannel
  }
}

class FakeDataChannel {
  readonly readyState = 'open'
  readonly bufferedAmount = 0
  bufferedAmountLowThreshold = 0
  binaryType: BinaryType = 'arraybuffer'
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  onbufferedamountlow: ((event: Event) => void) | null = null
  peer: FakeDataChannel | undefined
  readonly send = vi.fn((data: string | ArrayBuffer) => {
    queueMicrotask(() => this.peer?.onmessage?.({ data } as MessageEvent))
  })
  readonly close = vi.fn()

  constructor(
    readonly label: string,
    readonly protocol: string,
  ) {}
}

const profile: ConnectionUserInfo = {
  id: 'account',
  name: 'Player',
  avatar: '',
  textures: { SKIN: { url: '' } },
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Together peer negotiation', () => {
  it('does not emit another bridge attempt for a repeated LAN advertisement', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const server: LocalServer = {
      id: 'server',
      port: 25_566,
      close: vi.fn(),
      onConnection: vi.fn(),
    }
    const onMinecraftBridge = vi.fn()
    const listening = Promise.withResolvers<LocalServer>()
    const listen = vi.fn(() => listening.promise)
    const peer = new TogetherPeer({
      id: 'session',
      localId: 'local',
      remoteId: 'remote',
      initiator: true,
      iceServers: [],
      localNetwork: {
        listen,
        connect: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => undefined,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      onMinecraftBridge,
      logger: { emit: vi.fn() },
    })
    const metadata = FakePeerConnection.instance.channels.get('metadata')!
    const message = {
      data: JSON.stringify({
        type: 'lan',
        payload: { port: 25_565, motd: 'Server' },
      }),
    } as MessageEvent

    metadata.onmessage?.(message)
    metadata.onmessage?.(message)
    expect(listen).toHaveBeenCalledOnce()
    expect(onMinecraftBridge).toHaveBeenCalledTimes(1)
    listening.resolve(server)
    await vi.waitFor(() => expect(onMinecraftBridge).toHaveBeenCalledTimes(2))
    metadata.onmessage?.(message)
    await Promise.resolve()

    expect(listen).toHaveBeenCalledOnce()
    expect(onMinecraftBridge.mock.calls).toEqual([
      [expect.any(String), 'started', undefined],
      [expect.any(String), 'succeeded', undefined],
    ])
    peer.close()
  })

  it('terminates a pending Minecraft bridge when the peer closes', () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const onMinecraftBridge = vi.fn()
    const peer = new TogetherPeer({
      id: 'session',
      localId: 'local',
      remoteId: 'remote',
      initiator: false,
      iceServers: [],
      localNetwork: {
        listen: vi.fn(),
        connect: vi.fn(() => new Promise<LocalSocket>(() => {})),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => undefined,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      onMinecraftBridge,
      logger: { emit: vi.fn() },
    })
    const channel = new FakeDataChannel('25565', 'minecraft')
    Object.defineProperty(channel, 'readyState', { value: 'connecting', configurable: true })

    FakePeerConnection.instance.emit('datachannel', {
      channel: channel as unknown as RTCDataChannel,
    })
    peer.close()

    expect(onMinecraftBridge).toHaveBeenCalledTimes(2)
    expect(onMinecraftBridge.mock.calls[0]).toEqual([
      expect.any(String),
      'started',
      undefined,
    ])
    expect(onMinecraftBridge.mock.calls[1]).toEqual([
      onMinecraftBridge.mock.calls[0][0],
      'cancelled',
      'peer_closed',
    ])
  })

  it('uses the injected peer connection provider', () => {
    const connection = new FakePeerConnection() as unknown as RTCPeerConnection
    const createPeerConnection = vi.fn(() => connection)

    const peer = new TogetherPeer({
      id: 'session',
      localId: 'local',
      remoteId: 'remote',
      initiator: false,
      iceServers: [{ urls: 'stun:example.test' }],
      localNetwork: {
        listen: vi.fn(),
        connect: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      peerConnectionProvider: { createPeerConnection },
      getUserInfo: () => profile,
      getSharedManifest: () => undefined,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      logger: { emit: vi.fn() },
    })

    expect(createPeerConnection).toHaveBeenCalledWith({
      iceServers: [{ urls: 'stun:example.test' }],
      iceCandidatePoolSize: 8,
    })
    expect(peer.connection).toBe(connection)
  })

  it('streams a large manifest over the single files channel', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const manifest = {
      name: 'Shared instance',
      runtime: { minecraft: '1.21.1' },
      vmOptions: ['x'.repeat(100_000)],
      files: [{ path: 'mods/example.jar', size: 3, hashes: { sha1: 'hash' } }],
    } as unknown as InstanceManifest
    const peer = new TogetherPeer({
      id: 'session',
      localId: 'local',
      remoteId: 'remote',
      initiator: true,
      iceServers: [],
      localNetwork: {
        listen: vi.fn(),
        connect: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => manifest,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      logger: { emit: vi.fn() },
    })
    const connection = FakePeerConnection.instance
    const metadata = connection.channels.get('metadata')!
    const hostFiles = connection.channels.get('files')!
    const clientFiles = new FakeDataChannel('files', 'files')
    hostFiles.peer = clientFiles
    clientFiles.peer = hostFiles
    metadata.onopen?.(new Event('open'))

    const shareMessage = metadata.send.mock.calls
      .map(([data]) => typeof data === 'string' ? JSON.parse(data) : undefined)
      .find((message) => message?.type === 'share-available')
    expect(shareMessage).toEqual({
      type: 'share-available',
      payload: { available: true, fingerprint: undefined, revision: 0 },
    })
    expect(JSON.stringify(shareMessage)).not.toContain(manifest.vmOptions![0])

    const client = new FileTransferChannel(
      clientFiles as unknown as RTCDataChannel,
      async () => undefined,
      1_024,
    )
    const chunks: Uint8Array[] = []
    let resolve!: () => void
    const completed = new Promise<void>((value) => { resolve = value })
    const destination: TransferWritable = {
      write(data) {
        chunks.push(new Uint8Array(data))
        return true
      },
      end: resolve,
      destroy: vi.fn(),
      onDrain: vi.fn(),
    }

    await client.download('/sharing', destination)
    await completed

    const content = new TextDecoder().decode(concatChunks(chunks))
    expect(JSON.parse(content)).toEqual(manifest)
    const sentChunks = hostFiles.send.mock.calls
      .map(([data]) => data)
      .filter((data): data is ArrayBuffer => data instanceof ArrayBuffer)
    expect(sentChunks.length).toBeGreaterThan(1)
    expect(sentChunks.every((chunk) => chunk.byteLength <= 1_024)).toBe(true)
    expect(connection.channels.size).toBe(2)
    peer.close()
  })

  it('pulls manifests after LAN discovery and only when the advertised revision changes', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    let manifest = {
      runtime: { minecraft: '1.21.1' },
      files: [{ path: 'mods/example.jar', size: 3, hashes: { sha1: 'first' } }],
      fingerprint: 'pack',
    } as unknown as InstanceManifest
    let revision = 1
    const host = new TogetherPeer({
      id: 'host-session',
      localId: 'host',
      remoteId: 'client',
      initiator: true,
      iceServers: [],
      localNetwork: {
        listen: vi.fn(),
        connect: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => manifest,
      getSharedManifestRevision: () => revision,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      logger: { emit: vi.fn() },
    })
    const hostConnection = FakePeerConnection.instance
    const hostMetadata = hostConnection.channels.get('metadata')!
    const hostFiles = hostConnection.channels.get('files')!

    const onShare = vi.fn()
    const client = new TogetherPeer({
      id: 'client-session',
      localId: 'client',
      remoteId: 'host',
      initiator: false,
      iceServers: [],
      localNetwork: {
        listen: vi.fn(async () => ({
          port: 30_000,
          close: vi.fn(),
          onConnection: vi.fn(),
        })),
        connect: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => undefined,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare,
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      logger: { emit: vi.fn() },
    })
    const clientConnection = FakePeerConnection.instance
    const clientMetadata = new FakeDataChannel('metadata', 'metadata')
    const clientFiles = new FakeDataChannel('files', 'files')
    hostMetadata.peer = clientMetadata
    clientMetadata.peer = hostMetadata
    hostFiles.peer = clientFiles
    clientFiles.peer = hostFiles
    clientConnection.emit('datachannel', { channel: clientMetadata as unknown as RTCDataChannel })
    clientConnection.emit('datachannel', { channel: clientFiles as unknown as RTCDataChannel })
    hostMetadata.onopen?.(new Event('open'))
    clientMetadata.onopen?.(new Event('open'))

    await Promise.resolve()
    expect(onShare).not.toHaveBeenCalled()

    host.sendLan(25_565, 'Local World')
    await vi.waitFor(() => expect(onShare).toHaveBeenCalledTimes(1))
    expect(onShare.mock.calls[0][1]).toMatchObject({ fingerprint: 'pack' })

    host.sendShare(manifest, revision)
    await Promise.resolve()
    expect(onShare).toHaveBeenCalledTimes(1)

    manifest = {
      ...manifest,
      files: [{ path: 'mods/example.jar', size: 4, hashes: { sha1: 'second' } }],
    }
    revision++
    host.sendShare(manifest, revision)
    await vi.waitFor(() => expect(onShare).toHaveBeenCalledTimes(2))
    expect(onShare.mock.calls[1][1]).toMatchObject({
      files: [{ hashes: { sha1: 'second' } }],
    })

    host.close()
    client.close()
  })

  it('applies a repeated answer once while accepting newly gathered candidates', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const events: MultiplayerLogEvent[] = []
    const peer = new TogetherPeer({
      id: 'session',
      localId: 'local',
      remoteId: 'remote',
      initiator: true,
      iceServers: [],
      localNetwork: {
        listen: vi.fn(),
        connect: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => undefined,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      logger: { emit: (event) => events.push(event) },
    })
    const connection = FakePeerConnection.instance
    const firstCandidate = { candidate: 'candidate:first', mid: '0' }
    const secondCandidate = { candidate: 'candidate:second', mid: '0' }

    await peer.applyRemoteDescription({ type: 'answer', sdp: 'answer-sdp' }, [firstCandidate])
    await peer.applyRemoteDescription(
      { type: 'answer', sdp: 'answer-sdp' },
      [firstCandidate, secondCandidate],
    )

    expect(connection.setRemoteDescription).toHaveBeenCalledOnce()
    expect(connection.addIceCandidate).toHaveBeenCalledTimes(2)
    expect(events).toContainEqual({
      level: 'info',
      event: 'together.description.remote_applied',
      data: expect.objectContaining({
        session: 'session',
        duplicate: true,
        candidatesAdded: 1,
        candidatesSkipped: 1,
      }),
    })
  })

  it('uses the candidate pair selected by the WebRTC transport', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const peer = new TogetherPeer({
      id: 'session',
      localId: 'local',
      remoteId: 'remote',
      initiator: true,
      iceServers: [],
      localNetwork: {
        listen: vi.fn(),
        connect: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => undefined,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      logger: { emit: vi.fn() },
    })
    FakePeerConnection.instance.getStats.mockResolvedValue(new Map([
      ['old-pair', { type: 'candidate-pair', nominated: true, state: 'succeeded', localCandidateId: 'relay', remoteCandidateId: 'remote-relay' }],
      ['active-pair', { type: 'candidate-pair', nominated: true, state: 'succeeded', localCandidateId: 'host', remoteCandidateId: 'remote-host' }],
      ['transport', { type: 'transport', selectedCandidatePairId: 'active-pair' }],
      ['relay', { type: 'local-candidate', address: 'relay.example', port: 1, candidateType: 'relay', protocol: 'udp' }],
      ['remote-relay', { type: 'remote-candidate', address: 'relay.remote', port: 2, candidateType: 'relay', protocol: 'udp' }],
      ['host', { type: 'local-candidate', address: '192.168.1.2', port: 3, candidateType: 'host', protocol: 'udp' }],
      ['remote-host', { type: 'remote-candidate', address: '192.168.1.3', port: 4, candidateType: 'host', protocol: 'udp' }],
    ]))

    await expect(peer.selectedCandidate()).resolves.toEqual({
      local: { address: '192.168.1.2', port: 3, type: 'host', transportType: 'udp' },
      remote: { address: '192.168.1.3', port: 4, type: 'host', transportType: 'udp' },
    })
  })

  it('buffers Minecraft channel data until the local game socket connects', async () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const events: MultiplayerLogEvent[] = []
    let resolveConnection!: (socket: LocalSocket) => void
    const localSocket: LocalSocket = {
      id: 'local-game',
      write: vi.fn(() => true),
      end: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      close: vi.fn(),
      onData: vi.fn(),
      onWrite: vi.fn(),
      onDrain: vi.fn(),
      onClose: vi.fn(),
      onError: vi.fn(),
    }
    const peer = new TogetherPeer({
      id: 'session',
      localId: 'local',
      remoteId: 'remote',
      initiator: false,
      iceServers: [],
      localNetwork: {
        listen: vi.fn(),
        connect: vi.fn(() => new Promise<LocalSocket>((resolve) => { resolveConnection = resolve })),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => undefined,
      onDescription: vi.fn(),
      onIdentity: vi.fn(),
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      logger: { emit: (event) => events.push(event) },
    })
    const channel = {
      label: '5134',
      protocol: 'minecraft',
      readyState: 'open',
      bufferedAmount: 0,
      bufferedAmountLowThreshold: 0,
      binaryType: 'arraybuffer',
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      onbufferedamountlow: null,
    } as unknown as RTCDataChannel
    FakePeerConnection.instance.emit('datachannel', { channel })
    const handshake = Uint8Array.from([0, 1, 2, 3]).buffer
    channel.onmessage?.({ data: handshake } as MessageEvent)

    resolveConnection(localSocket)
    await vi.waitFor(() => expect(localSocket.write).toHaveBeenCalledWith(handshake))

    expect(events).toContainEqual({
      level: 'info',
      event: 'together.minecraft.local_connected',
      data: expect.objectContaining({ bridgeId: 'session:5134:1', pendingBytes: 4 }),
    })
  })

  it('keeps the room peer ID when metadata reports the device peer ID', () => {
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection)
    const onIdentity = vi.fn()
    const peer = new TogetherPeer({
      id: 'session',
      localId: 'local',
      remoteId: 'room-peer',
      initiator: false,
      iceServers: [],
      localNetwork: {
        listen: vi.fn(),
        connect: vi.fn(),
        discoverLan: vi.fn(),
        broadcastLan: vi.fn(),
      },
      getUserInfo: () => profile,
      getSharedManifest: () => undefined,
      onDescription: vi.fn(),
      onIdentity,
      onShare: vi.fn(),
      onLan: vi.fn(),
      onState: vi.fn(),
      onPing: vi.fn(),
      onClosed: vi.fn(),
      logger: { emit: vi.fn() },
    })
    const channel = {
      protocol: 'metadata',
      readyState: 'open',
      send: vi.fn(),
      close: vi.fn(),
    } as unknown as RTCDataChannel

    FakePeerConnection.instance.emit('datachannel', { channel })
    channel.onmessage?.({
      data: JSON.stringify({
        type: 'identity',
        payload: { peerId: 'device-peer', profile },
      }),
    } as MessageEvent)

    expect(peer.remoteId).toBe('room-peer')
    expect(onIdentity).toHaveBeenCalledWith(peer, profile)
  })
})

function concatChunks(chunks: Uint8Array[]) {
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}