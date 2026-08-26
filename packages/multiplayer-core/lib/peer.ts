import type {
  ConnectionUserInfo,
  InstanceManifest,
  SelectedCandidateInfo,
  TransferDescription,
} from '@xmcl/runtime-api'
import type { LocalNetwork, LocalServer, LocalSocket } from './localNetwork'
import type { SharedFiles } from './localNetwork'
import { FileTransferChannel, type TransferSource, type TransferWritable } from './fileTransfer'
import type { MultiplayerLogger } from './logger'
import { summarizeError } from './logger'
import { getSelectedCandidatePair } from './selectedCandidate'
import { createLocalOffer, defaultPeerConnectionProvider, type PeerConnectionProvider } from './peerConnection'

interface MetadataMessage {
  type: 'identity' | 'heartbeat' | 'heartbeat-ack' | 'lan' | 'share' | 'share-available'
  payload: unknown
}

export interface TogetherPeerOptions {
  id: string
  localId: string
  remoteId?: string
  initiator: boolean
  iceServers: RTCIceServer[]
  localNetwork: LocalNetwork
  sharedFiles?: SharedFiles
  peerConnectionProvider?: PeerConnectionProvider
  getUserInfo(): ConnectionUserInfo
  getSharedManifest(): InstanceManifest | undefined
  getSharedManifestRevision?(): number
  onDescription(description: TransferDescription, type: 'offer' | 'answer', complete: boolean): void
  onIdentity(peer: TogetherPeer, info: ConnectionUserInfo): void
  onShare(peer: TogetherPeer, manifest?: InstanceManifest): void
  onLan(peer: TogetherPeer, info: { port: number; motd: string }): void
  onState(peer: TogetherPeer): void
  onPing(peer: TogetherPeer, ping: number): void
  onClosed(peer: TogetherPeer): void
  logger: MultiplayerLogger
}

const pendingSocketLimit = 4 * 1024 * 1024
const iceIdleTimeout = 5_000

export class TogetherPeer {
  readonly connection: RTCPeerConnection
  remoteId: string
  remoteInfo: ConnectionUserInfo | undefined
  private metadata: RTCDataChannel | undefined
  private files: FileTransferChannel | undefined
  private remoteManifest: InstanceManifest | undefined
  private remoteManifestRevision: number | undefined
  private advertisedManifestRevision: number | undefined
  private remoteLanAvailable = false
  private manifestDownload: Promise<void> | undefined
  private readonly candidates: Array<{ candidate: string; mid: string }> = []
  private readonly remoteCandidates = new Set<string>()
  private readonly proxies = new Map<number, LocalServer>()
  private localDescription: RTCSessionDescriptionInit | undefined
  private remoteDescription: RTCSessionDescriptionInit | undefined
  private descriptionTimer: ReturnType<typeof setTimeout> | undefined
  private iceTimer: ReturnType<typeof setTimeout> | undefined
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined
  private remoteQueue = Promise.resolve()
  private nextMinecraftBridgeId = 0
  private closed = false

  constructor(readonly options: TogetherPeerOptions) {
    this.remoteId = options.remoteId ?? ''
    this.connection = (options.peerConnectionProvider ?? defaultPeerConnectionProvider).createPeerConnection({
      iceServers: options.iceServers,
      iceCandidatePoolSize: 8,
    })
    this.bindConnection()
    if (options.initiator) {
      this.bindMetadata(
        this.connection.createDataChannel('metadata', { ordered: true, protocol: 'metadata' }),
      )
      this.bindFiles(
        this.connection.createDataChannel('files', { ordered: true, protocol: 'files' }),
      )
    }
  }

  get id() {
    return this.options.id
  }

  get isClosed() {
    return this.closed
  }

  get isMetadataOpen() {
    return this.metadata?.readyState === 'open'
  }

  async initiate() {
    const offer = await createLocalOffer(this.connection)
    this.localDescription = { type: offer.type, sdp: offer.sdp ?? '' }
    this.publishDescription(false)
    this.scheduleIceFallback()
  }

  applyRemoteDescription(
    description: RTCSessionDescriptionInit,
    candidates: Array<{ candidate: string; mid: string }>,
  ) {
    const operation = async () => {
      if (this.closed) throw new Error('multiplayer_peer_closed')
      const descriptionChanged =
        this.remoteDescription?.sdp !== description.sdp ||
        this.remoteDescription?.type !== description.type
      this.options.logger.emit({
        level: 'info',
        event: 'together.description.remote_received',
        data: {
          session: this.id,
          remoteId: this.remoteId,
          type: description.type,
          duplicate: !descriptionChanged,
          signalingState: this.connection.signalingState,
          sdp: description.sdp ?? '',
          candidates,
        },
      })
      if (
        descriptionChanged &&
        description.type === 'offer' &&
        this.connection.signalingState !== 'stable' &&
        this.options.initiator
      ) {
        this.options.logger.emit({
          level: 'info',
          event: 'together.signaling.rollback',
          data: { session: this.id, remoteId: this.remoteId, type: description.type },
        })
        await this.connection.setLocalDescription({ type: 'rollback' })
      }
      if (descriptionChanged) {
        await this.connection.setRemoteDescription(description)
        this.remoteDescription = { ...description }
      }
      let candidatesAdded = 0
      let candidatesSkipped = 0
      for (const candidate of candidates) {
        const key = `${candidate.mid}\n${candidate.candidate}`
        if (this.remoteCandidates.has(key)) {
          candidatesSkipped++
          continue
        }
        this.remoteCandidates.add(key)
        await this.connection.addIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.mid,
        })
        candidatesAdded++
      }
      this.options.logger.emit({
        level: 'info',
        event: 'together.description.remote_applied',
        data: {
          session: this.id,
          remoteId: this.remoteId,
          type: description.type,
          duplicate: !descriptionChanged,
          signalingState: this.connection.signalingState,
          candidatesAdded,
          candidatesSkipped,
        },
      })
      if (descriptionChanged && description.type === 'offer') {
        const answer = await this.connection.createAnswer()
        await this.connection.setLocalDescription(answer)
        this.localDescription = { type: answer.type, sdp: answer.sdp ?? '' }
        this.publishDescription(false)
        this.scheduleIceFallback()
      }
    }
    const result = this.remoteQueue.then(operation, operation)
    this.remoteQueue = result.catch(() => {})
    return result
  }

  sendLan(port: number, motd = 'Minecraft Server') {
    this.sendMetadata({ type: 'lan', payload: { port, motd } })
  }

  hasLocalProxy(port: number) {
    return Array.from(this.proxies.values()).some((server) => server.port === port)
  }

  sendShare(manifest?: InstanceManifest, revision = this.options.getSharedManifestRevision?.() ?? 0) {
    this.sendMetadata({
      type: 'share-available',
      payload: {
        available: manifest !== undefined,
        fingerprint: manifest?.fingerprint,
        revision,
      },
    })
  }

  download(path: string, destination: TransferWritable) {
    if (!this.files) return Promise.reject(new Error('multiplayer_file_channel_unavailable'))
    return this.files.download(path, destination)
  }

  getSharedFileSize(path: string) {
    const prefix = '/sharing/'
    if (!path.startsWith(prefix)) return undefined
    const filePath = path.substring(prefix.length)
    const file = this.remoteManifest?.files.find((entry) => entry.path === filePath)
    return file ? file.size ?? null : undefined
  }

  close() {
    if (this.closed) return
    this.closed = true
    if (this.descriptionTimer) clearTimeout(this.descriptionTimer)
    if (this.iceTimer) clearTimeout(this.iceTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    for (const proxy of this.proxies.values()) proxy.close()
    this.proxies.clear()
    if (this.metadata?.readyState === 'open') this.metadata.close()
    this.files?.close()
    this.connection.close()
    this.options.onClosed(this)
  }

  async selectedCandidate(): Promise<
    { local: SelectedCandidateInfo; remote: SelectedCandidateInfo } | undefined
  > {
    return getSelectedCandidatePair(this.connection)
  }

  private bindConnection() {
    this.connection.addEventListener('icecandidate', ({ candidate }) => {
      if (candidate?.candidate) {
        const value = candidate.toJSON()
        if (!value.candidate) return
        const current = { candidate: value.candidate, mid: value.sdpMid ?? '' }
        this.candidates.push(current)
        this.options.logger.emit({
          level: 'info',
          event: 'together.ice.local_candidate',
          data: { session: this.id, remoteId: this.remoteId, ...current },
        })
        this.publishDescription(false)
        this.scheduleIceFallback()
      } else {
        this.options.logger.emit({
          level: 'info',
          event: 'together.ice.local_complete',
          data: { session: this.id, remoteId: this.remoteId, candidates: this.candidates.slice() },
        })
        this.publishDescription(true)
      }
    })
    this.connection.addEventListener('icegatheringstatechange', () => {
      this.options.logger.emit({
        level: 'info',
        event: 'together.ice.state',
        data: {
          session: this.id,
          remoteId: this.remoteId,
          iceGatheringState: this.connection.iceGatheringState,
        },
      })
      if (this.connection.iceGatheringState === 'complete') this.publishDescription(true)
      this.options.onState(this)
    })
    this.connection.addEventListener('signalingstatechange', () => {
      this.options.logger.emit({
        level: 'info',
        event: 'together.signaling.state',
        data: {
          session: this.id,
          remoteId: this.remoteId,
          signalingState: this.connection.signalingState,
        },
      })
      this.options.onState(this)
    })
    this.connection.addEventListener('connectionstatechange', () => {
      this.options.logger.emit({
        level: 'info',
        event: 'together.connection.state',
        data: {
          session: this.id,
          remoteId: this.remoteId,
          connectionState: this.connection.connectionState,
          iceConnectionState: this.connection.iceConnectionState,
          signalingState: this.connection.signalingState,
        },
      })
      this.options.onState(this)
      if (this.connection.connectionState === 'closed') this.close()
    })
    this.connection.addEventListener('datachannel', ({ channel }) => {
      if (channel.protocol === 'metadata') this.bindMetadata(channel)
      else if (channel.protocol === 'files') this.bindFiles(channel)
      else if (channel.protocol === 'minecraft') this.connectMinecraft(channel)
    })
  }

  private bindMetadata(channel: RTCDataChannel) {
    if (this.metadata && this.metadata !== channel) this.metadata.close()
    this.metadata = channel
    channel.onopen = () => {
      this.sendMetadata({
        type: 'identity',
        payload: { peerId: this.options.localId, profile: this.options.getUserInfo() },
      })
      this.sendShare(this.options.getSharedManifest())
      this.heartbeatTimer = setInterval(() => {
        this.sendMetadata({ type: 'heartbeat', payload: { time: Date.now() } })
      }, 1_000)
      this.options.onState(this)
    }
    channel.onmessage = ({ data }) => {
      if (typeof data !== 'string') return
      try {
        this.handleMetadata(JSON.parse(data) as MetadataMessage)
      } catch (error) {
        this.options.logger.emit({
          level: 'warn',
          event: 'together.metadata.invalid',
          data: { session: this.id, ...summarizeError(error) },
        })
      }
    }
    channel.onclose = () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  private handleMetadata(message: MetadataMessage) {
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return
    if (message.type === 'identity') {
      const payload = message.payload as { peerId?: unknown; profile?: unknown }
      if (typeof payload?.peerId !== 'string' || !isUserInfo(payload.profile)) return
      if (!this.remoteId) this.remoteId = payload.peerId
      this.remoteInfo = payload.profile
      this.options.onIdentity(this, payload.profile)
    } else if (message.type === 'heartbeat') {
      const time = (message.payload as { time?: unknown })?.time
      if (typeof time === 'number') {
        this.sendMetadata({ type: 'heartbeat-ack', payload: { time } })
      }
    } else if (message.type === 'heartbeat-ack') {
      const time = (message.payload as { time?: unknown })?.time
      if (typeof time === 'number') this.options.onPing(this, Date.now() - time)
    } else if (message.type === 'lan') {
      const payload = message.payload as { port?: unknown; motd?: unknown }
      if (!validPort(payload?.port) || typeof payload.motd !== 'string') return
      this.options.logger.emit({
        level: 'info',
        event: 'together.lan.received',
        data: { session: this.id, remoteId: this.remoteId, port: payload.port, motd: payload.motd },
      })
      this.remoteLanAvailable = true
      this.requestManifestIfNeeded()
      void this.ensureProxy(Number(payload.port), payload.motd).catch((error) => {
        this.options.logger.emit({
          level: 'error',
          event: 'together.lan.proxy_failed',
          data: {
            session: this.id,
            remoteId: this.remoteId,
            port: payload.port,
            ...summarizeError(error),
          },
        })
      })
    } else if (message.type === 'share') {
      const manifest = message.payload
      if (manifest === undefined || (manifest && typeof manifest === 'object')) {
        this.receiveManifest(manifest as InstanceManifest | undefined)
      }
    } else if (message.type === 'share-available') {
      const payload = message.payload as { available?: unknown; revision?: unknown }
      if (payload?.available === false) {
        this.advertisedManifestRevision = undefined
        this.remoteManifestRevision = undefined
        this.receiveManifest(undefined)
      } else if (payload?.available === true) {
        this.advertisedManifestRevision = typeof payload.revision === 'number'
          ? payload.revision
          : undefined
        this.requestManifestIfNeeded()
      }
    }
  }

  private bindFiles(channel: RTCDataChannel) {
    this.files?.close()
    this.files = new FileTransferChannel(
      channel,
      (path) => this.openSharedFile(path),
      this.connection.sctp?.maxMessageSize,
    )
    this.requestManifestIfNeeded()
  }

  private async openSharedFile(path: string): Promise<TransferSource | undefined> {
    if (path === '/sharing') {
      const manifest = this.options.getSharedManifest()
      if (!manifest) return undefined
      const data = new TextEncoder().encode(JSON.stringify(manifest))
      return { size: data.byteLength, data: data.buffer as ArrayBuffer }
    }
    const prefix = '/sharing/'
    if (!path.startsWith(prefix) || !this.options.sharedFiles) return undefined
    const filePath = path.substring(prefix.length)
    const file = this.options.getSharedManifest()?.files.find((entry) => entry.path === filePath)
    if (!file) return undefined
    return { size: file.size ?? 0, stream: await this.options.sharedFiles.open(filePath) }
  }

  private requestManifestIfNeeded() {
    if (!this.remoteLanAvailable || this.manifestDownload) return
    if (
      this.remoteManifest &&
      this.advertisedManifestRevision !== undefined &&
      this.remoteManifestRevision === this.advertisedManifestRevision
    ) return
    const revision = this.advertisedManifestRevision
    this.manifestDownload = this.downloadManifest(revision).finally(() => {
      this.manifestDownload = undefined
      if (this.advertisedManifestRevision !== revision) this.requestManifestIfNeeded()
    })
  }

  private async downloadManifest(revision: number | undefined) {
    if (!this.files) return
    const chunks: Uint8Array[] = []
    let size = 0
    const maxManifestSize = 64 * 1024 * 1024
    const destination: TransferWritable = {
      write: (data) => {
        const chunk = new Uint8Array(data)
        size += chunk.byteLength
        if (size > maxManifestSize) {
          this.files?.close(new Error('multiplayer_manifest_too_large'))
          return false
        }
        chunks.push(chunk)
        return true
      },
      end: () => {
        try {
          const data = new Uint8Array(size)
          let offset = 0
          for (const chunk of chunks) {
            data.set(chunk, offset)
            offset += chunk.byteLength
          }
          const manifest = JSON.parse(new TextDecoder().decode(data)) as InstanceManifest
          if (this.advertisedManifestRevision === revision) {
            this.remoteManifestRevision = revision
            this.receiveManifest(manifest)
          }
        } catch (error) {
          this.options.logger.emit({
            level: 'warn',
            event: 'together.files.manifest_invalid',
            data: { session: this.id, ...summarizeError(error) },
          })
        }
      },
      destroy() {},
      onDrain() {},
    }
    await this.files.download('/sharing', destination).catch((error) => {
      this.options.logger.emit({
        level: 'warn',
        event: 'together.files.manifest_failed',
        data: { session: this.id, ...summarizeError(error) },
      })
    })
  }

  private receiveManifest(manifest: InstanceManifest | undefined) {
    if (manifest) {
      for (const file of manifest.files) {
        const url = `peer://${this.id}/sharing/${file.path}`
        if (!file.downloads) file.downloads = [url]
        else if (!file.downloads.includes(url)) file.downloads.push(url)
      }
    }
    this.remoteManifest = manifest
    this.options.onShare(this, manifest)
  }

  private async ensureProxy(originalPort: number, motd: string) {
    const existing = this.proxies.get(originalPort)
    if (existing) {
      this.options.onLan(this, { port: existing.port, motd })
      return
    }
    const server = await this.options.localNetwork.listen(originalPort)
    if (this.closed) {
      server.close()
      return
    }
    this.proxies.set(originalPort, server)
    this.options.logger.emit({
      level: 'info',
      event: 'together.lan.proxy_created',
      data: {
        session: this.id,
        remoteId: this.remoteId,
        originalPort,
        localPort: server.port,
        motd,
      },
    })
    server.onConnection((socket) => {
      const bridgeId = this.minecraftBridgeId(originalPort)
      this.options.logger.emit({
        level: 'info',
        event: 'together.minecraft.proxy_connection',
        data: {
          bridgeId,
          session: this.id,
          remoteId: this.remoteId,
          originalPort,
          localPort: server.port,
          socketId: socket.id,
        },
      })
      const channel = this.connection.createDataChannel(String(originalPort), {
        ordered: true,
        protocol: 'minecraft',
      })
      bridge(channel, socket, this.bridgeContext(bridgeId, originalPort, 'proxy'))
    })
    this.options.onLan(this, { port: server.port, motd })
  }

  private connectMinecraft(channel: RTCDataChannel) {
    const port = Number.parseInt(channel.label, 10)
    if (!validPort(port)) {
      channel.close()
      return
    }
    const bridgeId = this.minecraftBridgeId(port)
    const context = this.bridgeContext(bridgeId, port, 'host')
    const pending = bufferChannelWhileConnecting(channel, context)
    this.options.logger.emit({
      level: 'info',
      event: 'together.minecraft.local_connecting',
      data: {
        bridgeId,
        session: this.id,
        remoteId: this.remoteId,
        port,
        channelState: channel.readyState,
      },
    })
    void this.options.localNetwork
      .connect(port)
      .then((socket) => {
        if (channel.readyState === 'closed') {
          socket.close()
          return
        }
        this.options.logger.emit({
          level: 'info',
          event: 'together.minecraft.local_connected',
          data: {
            bridgeId,
            session: this.id,
            remoteId: this.remoteId,
            port,
            socketId: socket.id,
            channelState: channel.readyState,
            pendingBytes: pending.bytes,
          },
        })
        bridge(channel, socket, context, pending.take())
      })
      .catch((error) => {
        this.options.logger.emit({
          level: 'warn',
          event: 'together.minecraft.connect_failed',
          data: { bridgeId, session: this.id, remoteId: this.remoteId, port, ...summarizeError(error) },
        })
        channel.close()
      })
  }

  private minecraftBridgeId(port: number) {
    return `${this.id}:${port}:${++this.nextMinecraftBridgeId}`
  }

  private bridgeContext(bridgeId: string, port: number, side: 'proxy' | 'host') {
    return {
      bridgeId,
      session: this.id,
      remoteId: this.remoteId,
      port,
      side,
      logger: this.options.logger,
    } satisfies MinecraftBridgeContext
  }

  private sendMetadata(message: MetadataMessage) {
    if (this.metadata?.readyState === 'open') this.metadata.send(JSON.stringify(message))
  }

  private scheduleIceFallback() {
    if (this.iceTimer) clearTimeout(this.iceTimer)
    this.iceTimer = setTimeout(() => this.publishDescription(true), iceIdleTimeout)
  }

  private publishDescription(complete: boolean) {
    if (!this.localDescription) return
    if (complete && this.iceTimer) clearTimeout(this.iceTimer)
    if (this.descriptionTimer) clearTimeout(this.descriptionTimer)
    const publish = () => {
      this.descriptionTimer = undefined
      this.options.logger.emit({
        level: 'info',
        event: 'together.description.local',
        data: {
          session: this.id,
          remoteId: this.remoteId,
          type: this.localDescription?.type,
          complete,
          signalingState: this.connection.signalingState,
          iceGatheringState: this.connection.iceGatheringState,
          sdp: this.localDescription?.sdp ?? '',
          candidates: this.candidates.slice(),
        },
      })
      this.options.onDescription(
        {
          id: this.options.localId,
          session: this.id,
          sdp: this.localDescription?.sdp ?? '',
          candidates: this.candidates.slice(),
        },
        this.localDescription?.type === 'answer' ? 'answer' : 'offer',
        complete,
      )
    }
    if (complete) publish()
    else this.descriptionTimer = setTimeout(publish, 100)
  }
}

function validPort(port: unknown) {
  return Number.isSafeInteger(port) && Number(port) > 0 && Number(port) <= 65_535
}

function isUserInfo(value: unknown): value is ConnectionUserInfo {
  if (!value || typeof value !== 'object') return false
  const profile = value as Partial<ConnectionUserInfo>
  return (
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    typeof profile.avatar === 'string' &&
    !!profile.textures &&
    typeof profile.textures === 'object'
  )
}

interface MinecraftBridgeContext {
  bridgeId: string
  session: string
  remoteId: string
  port: number
  side: 'proxy' | 'host'
  logger: MultiplayerLogger
}

function bufferChannelWhileConnecting(channel: RTCDataChannel, context: MinecraftBridgeContext) {
  channel.binaryType = 'arraybuffer'
  const pending: ArrayBuffer[] = []
  let bytes = 0
  channel.onmessage = ({ data }) => {
    const buffer = channelData(data)
    if (!buffer) return
    bytes += buffer.byteLength
    if (bytes > pendingSocketLimit) {
      context.logger.emit({
        level: 'warn',
        event: 'together.minecraft.pending_overflow',
        data: bridgeLogData(context, { pendingBytes: bytes }),
      })
      pending.length = 0
      channel.close()
      return
    }
    pending.push(buffer)
  }
  return {
    get bytes() {
      return bytes
    },
    take() {
      return pending.splice(0)
    },
  }
}

function bridge(
  channel: RTCDataChannel,
  socket: LocalSocket,
  context: MinecraftBridgeContext,
  initialChannelData: ArrayBuffer[] = [],
) {
  channel.binaryType = 'arraybuffer'
  channel.bufferedAmountLowThreshold = 256 * 1024
  let pending: ArrayBuffer[] = []
  let pendingBytes = 0
  let socketToChannelBytes = 0
  let channelToSocketBytes = 0
  let loggedSocketData = false
  let loggedChannelData = false
  let loggedSocketWrite = false
  let closed = false
  const close = (reason: string, error?: Error) => {
    if (closed) return
    closed = true
    pending = []
    socket.close()
    if (channel.readyState !== 'closed') channel.close()
    context.logger.emit({
      level: error ? 'warn' : 'info',
      event: 'together.minecraft.bridge_closed',
      data: bridgeLogData(context, {
        reason,
        socketId: socket.id,
        channelState: channel.readyState,
        socketToChannelBytes,
        channelToSocketBytes,
        ...(error ? summarizeError(error) : {}),
      }),
    })
  }
  context.logger.emit({
    level: 'info',
    event: 'together.minecraft.bridge_started',
    data: bridgeLogData(context, {
      socketId: socket.id,
      channelState: channel.readyState,
      initialChannelBytes: initialChannelData.reduce((total, data) => total + data.byteLength, 0),
    }),
  })
  socket.onData((data) => {
    socketToChannelBytes += data.byteLength
    if (!loggedSocketData) {
      loggedSocketData = true
      context.logger.emit({
        level: 'info',
        event: 'together.minecraft.bridge_first_data',
        data: bridgeLogData(context, { direction: 'socket_to_channel', bytes: data.byteLength }),
      })
    }
    if (channel.readyState === 'open') {
      channel.send(data)
    } else {
      pendingBytes += data.byteLength
      if (pendingBytes > pendingSocketLimit) {
        close('socket_pending_overflow')
        return
      }
      pending.push(data)
    }
    if (channel.bufferedAmount > channel.bufferedAmountLowThreshold) socket.pause()
  })
  socket.onWrite((bytes) => {
    if (loggedSocketWrite) return
    loggedSocketWrite = true
    context.logger.emit({
      level: 'info',
      event: 'together.minecraft.socket_first_write',
      data: bridgeLogData(context, { bytes }),
    })
  })
  socket.onClose(() => close('socket_closed'))
  socket.onError((error) => close('socket_error', error))
  channel.onopen = () => {
    context.logger.emit({
      level: 'info',
      event: 'together.minecraft.channel_open',
      data: bridgeLogData(context, { socketId: socket.id, pendingBytes }),
    })
    for (const data of pending) channel.send(data)
    pending = []
    pendingBytes = 0
  }
  channel.onbufferedamountlow = () => socket.resume()
  channel.onmessage = ({ data }) => {
    const buffer = channelData(data)
    if (buffer) {
      channelToSocketBytes += buffer.byteLength
      if (!loggedChannelData) {
        loggedChannelData = true
        context.logger.emit({
          level: 'info',
          event: 'together.minecraft.bridge_first_data',
          data: bridgeLogData(context, {
            direction: 'channel_to_socket',
            bytes: buffer.byteLength,
            preview: hexPreview(buffer),
          }),
        })
      }
      socket.write(buffer)
    }
  }
  channel.onclose = () => close('channel_closed')
  channel.onerror = () => close('channel_error', new Error('multiplayer_minecraft_channel_error'))
  for (const data of initialChannelData) channel.onmessage?.({ data } as MessageEvent)
  if (channel.readyState === 'open') channel.onopen?.(new Event('open'))
}

function channelData(data: unknown) {
  if (data instanceof ArrayBuffer) return data
  if (ArrayBuffer.isView(data)) {
    return Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).buffer
  }
  return undefined
}

function bridgeLogData(context: MinecraftBridgeContext, data: Record<string, unknown>) {
  return {
    bridgeId: context.bridgeId,
    session: context.session,
    remoteId: context.remoteId,
    port: context.port,
    side: context.side,
    ...data,
  }
}

function hexPreview(data: ArrayBuffer) {
  return Array.from(new Uint8Array(data, 0, Math.min(data.byteLength, 32)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')
}
