import type {
  ConnectionUserInfo,
  Multiplayer,
  MultiplayerIceServerCredential,
  Peer,
  PeerState,
  SetRemoteDescriptionOptions,
  SharedState,
  ShareInstanceOptions,
  TransferDescription,
} from '@xmcl/runtime-api'
import { decodeDescription, encodeDescription } from './codec'
import { MultiplayerEvents } from './events'
import type { LocalNetwork, LocalLanServer, LocalServer, SharedFiles } from './localNetwork'
import type { MultiplayerLogger } from './logger'
import { noopMultiplayerLogger, summarizeError } from './logger'
import { TogetherPeer } from './peer'
import { createPeerDownloadServer } from './peerDownload'
import { TogetherRoom, type TogetherRoomApi } from './room'
import type { PeerConnectionProvider } from './peerConnection'

export interface TogetherMultiplayerOptions {
  roomApi: TogetherRoomApi
  localNetwork: LocalNetwork
  peerConnectionProvider?: PeerConnectionProvider
  waitForIceServersBeforePeer?: boolean
  sharedFiles?: SharedFiles
  setDownloadPort?(port: number): Promise<void>
  logger?: MultiplayerLogger
}

export interface TogetherMultiplayer extends Multiplayer {
  start(localId: string): Promise<void>
  setState(state: SharedState<PeerState>): void
  shareInstance(options: ShareInstanceOptions): Promise<void>
  dispose(): Promise<void>
}

export function createTogetherMultiplayer(options: TogetherMultiplayerOptions): TogetherMultiplayer {
  const logger = options.logger ?? noopMultiplayerLogger
  const events = new MultiplayerEvents()
  const peers = new Map<string, TogetherPeer>()
  const roomPeers = new Map<string, TogetherPeer>()
  let state: SharedState<PeerState> | undefined
  let localId = ''
  let ready = false
  let resolveStarted!: () => void
  const started = new Promise<void>((resolve) => {
    resolveStarted = resolve
  })
  let userInfo: ConnectionUserInfo = {
    id: '',
    name: '',
    avatar: '',
    textures: { SKIN: { url: '' } },
  }
  let sharedManifest: ShareInstanceOptions['manifest']
  let iceServers: RTCIceServer[] = []
  let iceServersExpireAt = 0
  let iceServersRefresh: Promise<void> | undefined
  let room: TogetherRoom | undefined
  let roomOperation = 0
  const roomReconnectAttempts = new Map<string, number>()
  const roomReconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  let exposedPorts: number[] = []
  let downloadServer: LocalServer | undefined
  let disposed = false
  let exposedPortsListener: ((ports: [number, number][]) => void) | undefined
  const lanDiscoveryListener = (server: LocalLanServer) => {
    if (disposed || Array.from(peers.values()).some((peer) => peer.hasLocalProxy(server.port))) return
    events.emit('local-lan', server)
    for (const peer of peers.values()) {
      if (peer.isMetadataOpen) peer.sendLan(server.port, server.motd)
    }
  }

  const peerByRemoteId = (remoteId: string) =>
    Array.from(peers.values()).find((peer) => peer.remoteId === remoteId)

  const dropPeer = (peer: TogetherPeer) => {
    if (peers.get(peer.id) !== peer) return
    peers.delete(peer.id)
    for (const [remoteId, roomPeer] of roomPeers) {
      if (roomPeer === peer) roomPeers.delete(remoteId)
    }
    state?.connectionDrop(peer.id)
  }

  const clearRoomReconnectTimer = (remoteId: string) => {
    const timer = roomReconnectTimers.get(remoteId)
    if (timer) clearTimeout(timer)
    roomReconnectTimers.delete(remoteId)
  }

  const retryRoomPeer = (peer: TogetherPeer) => {
    const remoteId = peer.remoteId
    const activeRoom = room
    if (
      !remoteId ||
      !activeRoom ||
      activeRoom.role !== 'master' ||
      !peer.options.initiator ||
      roomPeers.get(remoteId) !== peer
    ) {
      return
    }
    clearRoomReconnectTimer(remoteId)
    const attempt = (roomReconnectAttempts.get(remoteId) ?? 0) + 1
    peer.close()
    if (attempt > 6) {
      roomReconnectAttempts.delete(remoteId)
      if (activeRoom.canRemove(remoteId)) activeRoom.remove(remoteId)
      return
    }
    roomReconnectAttempts.set(remoteId, attempt)
    logger.emit({
      level: 'warn',
      event: 'together.room.peer_reconnecting',
      data: { remoteId, session: peer.id, attempt },
    })
    const replacement = createPeer({ remoteId, initiator: true })
    roomPeers.set(remoteId, replacement)
  }

  const createPeer = (peerOptions: {
    session?: string
    remoteId?: string
    initiator: boolean
    sharedTurnServer?: RTCIceServer
  }) => {
    const session = peerOptions.session ?? crypto.randomUUID()
    const existing = peers.get(session)
    if (existing) return existing
    const servers = peerOptions.sharedTurnServer
      ? [peerOptions.sharedTurnServer, ...iceServers]
      : iceServers
    logger.emit({
      level: 'info',
      event: 'together.connection.creating',
      data: { session, rtc: typeof RTCPeerConnection },
    })
    let peer!: TogetherPeer
    let localDescriptionRevision = 0
    try {
      peer = new TogetherPeer({
        id: session,
        localId,
        remoteId: peerOptions.remoteId,
        initiator: peerOptions.initiator,
        iceServers: servers,
        localNetwork: options.localNetwork,
        peerConnectionProvider: options.peerConnectionProvider,
        sharedFiles: options.sharedFiles,
        getUserInfo: () => userInfo,
        getSharedManifest: () => sharedManifest,
        onDescription(current, descriptionType, complete) {
          const revision = ++localDescriptionRevision
          if (peer.remoteId && room) {
            room.sendDescription(
              peer.remoteId,
              current,
              descriptionType,
              peerOptions.sharedTurnServer,
            )
          }
          void encodeDescription(current)
            .then((description) => {
              if (peers.get(peer.id) === peer && revision === localDescriptionRevision) {
                state?.connectionLocalDescription({ id: peer.id, description })
              }
            })
            .catch((error) => {
              logger.emit({
                level: 'error',
                event: 'together.description.encode_failed',
                data: { session: peer.id, ...summarizeError(error) },
              })
            })
          for (const candidate of current.candidates) {
            const match = /(?:^|\s)([^\s]+)\s+\d+\s+typ\s+srflx(?:\s|$)/.exec(candidate.candidate)
            if (match) state?.ipsSet(Array.from(new Set([...(state.ips ?? []), match[1]])))
          }
        },
        onIdentity(current, info) {
          state?.connectionRemoteSet({ id: current.id, remoteId: current.remoteId })
          state?.connectionUserInfo({ id: current.id, info })
        },
        onShare(current, manifest) {
          state?.connectionShareManifest({ id: current.id, manifest })
          events.emit('share', { id: current.id, manifest })
        },
        onLan(current, info) {
          events.emit('lan', { ...info, session: current.id })
          logger.emit({
            level: 'info',
            event: 'together.lan.broadcasting',
            data: { session: current.id, motd: info.motd, port: info.port },
          })
          void options.localNetwork.broadcastLan(info).catch((error) => {
            logger.emit({
              level: 'warn',
              event: 'together.lan.broadcast_failed',
              data: { session: current.id, port: info.port, ...summarizeError(error) },
            })
          })
        },
        onState(current) {
          const connection = current.connection
          state?.connectionStateChange({
            id: current.id,
            connectionState: connection.connectionState,
          })
          state?.iceGatheringStateChange({
            id: current.id,
            iceGatheringState: connection.iceGatheringState,
          })
          state?.signalingStateChange({ id: current.id, signalingState: connection.signalingState })
          if (connection.connectionState === 'connected') {
            if (current.remoteId) {
              clearRoomReconnectTimer(current.remoteId)
              roomReconnectAttempts.delete(current.remoteId)
              room?.setRtcState(current.remoteId, 'connected')
            }
            for (const port of exposedPorts) current.sendLan(port)
            void current.selectedCandidate().then((selected) => {
              if (selected && peers.get(current.id) === current) {
                state?.connectionSelectedCandidate({ id: current.id, ...selected })
                logger.emit({
                  level: 'info',
                  event: 'together.connection.selected_candidate',
                  data: {
                    session: current.id,
                    remoteId: current.remoteId,
                    local: selected.local,
                    remote: selected.remote,
                  },
                })
              }
            })
          } else if (
            current.remoteId &&
            (connection.connectionState === 'disconnected' ||
              connection.connectionState === 'failed')
          ) {
            room?.setRtcState(current.remoteId, 'negotiating')
            if (connection.connectionState === 'failed') {
              retryRoomPeer(current)
            } else if (!roomReconnectTimers.has(current.remoteId)) {
              const remoteId = current.remoteId
              roomReconnectTimers.set(remoteId, setTimeout(() => {
                roomReconnectTimers.delete(remoteId)
                if (current.connection.connectionState === 'disconnected') retryRoomPeer(current)
              }, 5_000))
            }
          }
        },
        onPing(current, ping) {
          state?.connectionPing({ id: current.id, ping })
        },
        onClosed: dropPeer,
        logger,
      })
    } catch (error) {
      logger.emit({
        level: 'error',
        event: 'together.connection.create_failed',
        data: { session, ...summarizeError(error) },
      })
      const details = summarizeError(error)
      throw new Error(details.message, { cause: error })
    }
    peers.set(session, peer)
    state?.connectionAdd(toPeerState(peer, servers[0]))
    logger.emit({
      level: 'info',
      event: 'together.connection.created',
      data: { session, remoteId: peerOptions.remoteId ?? '', initiator: peerOptions.initiator },
    })
    if (peerOptions.initiator) {
      void peer.initiate().catch((error) => {
        logger.emit({
          level: 'error',
          event: 'together.negotiation.failed',
          data: { session, ...summarizeError(error) },
        })
      })
    }
    return peer
  }

  const applyDescription = async (
    description: TransferDescription,
    type: 'offer' | 'answer',
    remoteId?: string,
    sharedTurnServer?: RTCIceServer,
  ) => {
    const peer =
      peers.get(description.session) ??
      createPeer({
        session: description.session,
        remoteId: remoteId || description.id,
        initiator: false,
        sharedTurnServer,
      })
    if (remoteId && !peer.remoteId) peer.remoteId = remoteId
    if (remoteId) roomPeers.set(remoteId, peer)
    await peer.applyRemoteDescription({ type, sdp: description.sdp }, description.candidates)
    return peer.id
  }

  const roomCallbacks = () => ({
    initiate(remoteId: string) {
      const existing = roomPeers.get(remoteId)
      if (existing && !existing.isClosed) {
        logger.emit({
          level: 'info',
          event: 'together.room.peer_reused',
          data: {
            remoteId,
            session: existing.id,
            connectionState: existing.connection.connectionState,
            signalingState: existing.connection.signalingState,
            metadataOpen: existing.isMetadataOpen,
          },
        })
        return
      }
      if (existing) roomPeers.delete(remoteId)
      const peer = createPeer({ remoteId, initiator: true })
      roomPeers.set(remoteId, peer)
      logger.emit({
        level: 'info',
        event: 'together.room.peer_created',
        data: { remoteId, session: peer.id },
      })
    },
    apply(
      remoteId: string,
      description: TransferDescription,
      type: 'offer' | 'answer',
      sharedTurn?: RTCIceServer,
    ) {
      void applyDescription(description, type, remoteId, sharedTurn).catch((error) => {
        logger.emit({
          level: 'error',
          event: 'together.room.signal_failed',
          data: { remoteId, ...summarizeError(error) },
        })
      })
    },
    drop(remoteId: string) {
      clearRoomReconnectTimer(remoteId)
      roomReconnectAttempts.delete(remoteId)
      const peer = roomPeers.get(remoteId)
      roomPeers.delete(remoteId)
      if (peer) peer.close()
    },
    remap(previousRemoteId: string, remoteId: string) {
      clearRoomReconnectTimer(previousRemoteId)
      const reconnectAttempts = roomReconnectAttempts.get(previousRemoteId)
      roomReconnectAttempts.delete(previousRemoteId)
      if (reconnectAttempts !== undefined) roomReconnectAttempts.set(remoteId, reconnectAttempts)
      const peer = roomPeers.get(previousRemoteId)
      if (!peer) return
      const replaced = roomPeers.get(remoteId)
      if (replaced && replaced !== peer) replaced.close()
      roomPeers.delete(previousRemoteId)
      peer.remoteId = remoteId
      roomPeers.set(remoteId, peer)
      state?.connectionRemoteSet({ id: peer.id, remoteId })
      logger.emit({
        level: 'info',
        event: 'together.room.peer_remapped',
        data: { previousRemoteId, remoteId, session: peer.id },
      })
    },
    hasOpenMetadata(remoteId: string) {
      return roomPeers.get(remoteId)?.isMetadataOpen ?? false
    },
    onState(value: 'connecting' | 'connected' | 'closing' | 'closed') {
      state?.groupStateSet(value)
    },
    onRoomState(value: Parameters<PeerState['groupRoomStateSet']>[0]) {
      state?.groupRoomStateSet(value)
    },
    onReset() {
      room = undefined
      state?.groupReset()
    },
    onError(error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error))
      state?.groupErrorSet(normalized)
    },
    onPing(ping: number, timestamp: number) {
      state?.pingSet({ ping, timestamp })
    },
  })

  const enterRoom = async (
    admit: () => Promise<Awaited<ReturnType<TogetherRoomApi['createRoom']>>>,
  ) => {
    const operation = ++roomOperation
    await room?.quit()
    if (operation !== roomOperation) return
    room = undefined
    state?.groupReset()
    const admission = await admit()
    if (operation !== roomOperation) return
    const next = new TogetherRoom(admission, userInfo, options.roomApi, roomCallbacks(), logger)
    room = next
    state?.groupSet({
      group: admission.roomId,
      state: 'connecting',
      role: admission.role,
      maxPeers: admission.maxPeers,
      selfPeerId: admission.peerId,
    })
    try {
      await next.connect()
    } catch (error) {
      if (room === next) {
        room = undefined
        state?.groupReset()
        state?.groupErrorSet(error instanceof Error ? error : new Error(String(error)))
      }
      throw error
    }
  }

  const updateIceServers = (force = true) => {
    if (!force && Date.now() < iceServersExpireAt) return Promise.resolve()
    if (iceServersRefresh) return iceServersRefresh
    const refresh = options.roomApi.getIceServerCredential().then((credential) => {
      iceServers = normalizeIceServers(credential)
      const ttl = Math.max(30, credential.ttl ?? 300)
      iceServersExpireAt = Date.now() + ttl * 900
      state?.validIceServerSet(
        iceServers.flatMap((server) =>
          typeof server.urls === 'string' ? [server.urls] : server.urls,
        ),
      )
      state?.turnserversSet(credential.meta ?? {})
    })
    const current = refresh.finally(() => {
      if (iceServersRefresh === current) iceServersRefresh = undefined
    })
    iceServersRefresh = current
    return iceServersRefresh
  }

  const ensureIceServers = async () => {
    try {
      await updateIceServers(false)
    } catch (error) {
      logger.emit({
        level: 'warn',
        event: 'together.ice.refresh_failed',
        data: summarizeError(error),
      })
    }
  }

  const api: TogetherMultiplayer = {
    isReady: () => ready,
    getPeers: () => state?.connections ?? [],
    async start(id) {
      if (disposed) throw new Error('multiplayer_disposed')
      localId = id
      if (options.sharedFiles && !downloadServer) {
        downloadServer = await createPeerDownloadServer(
          options.localNetwork,
          (peerId) => peers.get(peerId),
        )
        await options.setDownloadPort?.(downloadServer.port)
      }
      await options.localNetwork
        .discoverLan(lanDiscoveryListener)
        .then(() => {
          logger.emit({ level: 'info', event: 'together.lan.ready', data: {} })
        })
        .catch((error) => {
          logger.emit({
            level: 'error',
            event: 'together.lan.start_failed',
            data: summarizeError(error),
          })
        })
      void ensureIceServers()
      ready = true
      resolveStarted()
      events.emit('ready')
    },
    setState(value) {
      if (state === value) return
      if (state && exposedPortsListener) {
        state.unsubscribe('exposedPortsSet', exposedPortsListener)
      }
      state = value
      state.connectionClear()
      exposedPorts = state.exposedPorts.map(([port]) => port)
      exposedPortsListener = (ports) => {
        exposedPorts = ports.map(([port]) => port)
        for (const peer of peers.values()) {
          for (const port of exposedPorts) peer.sendLan(port)
        }
      }
      state.subscribe('exposedPortsSet', exposedPortsListener)
    },
    setUserInfo(info) {
      userInfo = info
    },
    async initiate() {
      await started
      if (options.waitForIceServersBeforePeer) await ensureIceServers()
      else void ensureIceServers()
      return createPeer({ initiator: true }).id
    },
    async setRemoteDescription({ description, type }: SetRemoteDescriptionOptions) {
      await started
      if (options.waitForIceServersBeforePeer) await ensureIceServers()
      else void ensureIceServers()
      const decoded =
        typeof description === 'string' ? await decodeDescription(description) : description
      return applyDescription(decoded, type)
    },
    async drop(id) {
      const peer = peers.get(id)
      if (!peer) return
      if (peer.remoteId && room?.canRemove(peer.remoteId)) room.remove(peer.remoteId)
      else peer.close()
    },
    refreshIceServers: () => updateIceServers(true),
    async createGroup() {
      await started
      await ensureIceServers()
      return enterRoom(() => options.roomApi.createRoom(userInfo.name, 8))
    },
    async joinGroup(groupId) {
      await started
      await ensureIceServers()
      const normalized = groupId.trim()
      if (!normalized) throw new Error('multiplayer_room_id_required')
      return enterRoom(() => options.roomApi.joinRoom(normalized, userInfo.name, true))
    },
    async leaveGroup() {
      roomOperation++
      const current = room
      room = undefined
      await current?.quit()
      state?.groupReset()
    },
    async transferGroupMaster(peerId) {
      if (!room) throw new Error('multiplayer_room_missing')
      await room.transferMaster(peerId)
    },
    async shareInstance({ manifest, instancePath }) {
      sharedManifest = manifest
      await options.sharedFiles?.share(
        manifest ? instancePath : undefined,
        manifest?.files.map((file) => file.path) ?? [],
      )
      for (const peer of peers.values()) peer.sendShare(manifest)
    },
    async dispose() {
      if (disposed) return
      disposed = true
      roomOperation++
      const currentRoom = room
      room = undefined
      await currentRoom?.quit()
      for (const peer of Array.from(peers.values())) peer.close()
      peers.clear()
      roomPeers.clear()
      for (const timer of roomReconnectTimers.values()) clearTimeout(timer)
      roomReconnectTimers.clear()
      roomReconnectAttempts.clear()
      downloadServer?.close()
      downloadServer = undefined
      options.localNetwork.stopLanDiscovery?.(lanDiscoveryListener)
      await options.sharedFiles?.share(undefined, [])
      if (state && exposedPortsListener) {
        state.unsubscribe('exposedPortsSet', exposedPortsListener)
      }
      exposedPortsListener = undefined
      ready = false
      state?.connectionClear()
      state?.groupReset()
      events.removeAllListeners()
    },
    on(event, listener) {
      events.on(event, listener)
      return api
    },
    once(event, listener) {
      events.once(event, listener)
      return api
    },
    removeListener(event, listener) {
      events.removeListener(event, listener)
      return api
    },
  }

  return api
}

function toPeerState(peer: TogetherPeer, iceServer?: RTCIceServer): Peer {
  return {
    id: peer.id,
    remoteId: peer.remoteId,
    initiator: peer.options.initiator,
    userInfo: {
      id: '',
      name: '',
      avatar: '',
      textures: { SKIN: { url: '' } },
    },
    iceServer: iceServer ?? { urls: [] },
    triedIceServers: [],
    preferredIceServers: [],
    localDescriptionSDP: '',
    ping: -1,
    connectionState: peer.connection.connectionState,
    iceGatheringState: peer.connection.iceGatheringState,
    signalingState: peer.connection.signalingState,
  }
}

function normalizeIceServers(credential: MultiplayerIceServerCredential): RTCIceServer[] {
  const servers = (credential.servers ?? []).map((server) => ({
    ...server,
    urls: normalizeUrls(server.urls, server.credential ? 'turn' : 'stun'),
  }))
  if (credential.stuns.length) {
    servers.push({ urls: credential.stuns.map((url) => normalizeIceUrl(url, 'stun')) })
  }
  if (credential.uris?.length) {
    servers.push({
      urls: credential.uris.map((url) => normalizeIceUrl(url, 'turn')),
      username: credential.username,
      credential: credential.password,
    })
  }
  const seen = new Set<string>()
  return servers.filter((server) => {
    const key = JSON.stringify(server)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function normalizeUrls(urls: string | string[], fallback: 'stun' | 'turn') {
  if (typeof urls === 'string') return normalizeIceUrl(urls, fallback)
  return urls.map((url) => normalizeIceUrl(url, fallback))
}

function normalizeIceUrl(url: string, fallback: 'stun' | 'turn') {
  return /^(?:stun|stuns|turn|turns):/i.test(url) ? url : `${fallback}:${url}`
}
