import type { PeerConnectionProvider } from '@xmcl/multiplayer-core/peerConnection'
import {
  type RtcBridgeMessageChannel,
  type RtcBridgePort,
  type RtcCandidate,
  type RtcConnectionCommand,
  type RtcConnectionEvent,
  type RtcDataChannelCommand,
  type RtcDataChannelEvent,
  type RtcDescription,
  type RtcStatsEntry,
} from './BrowserRtcProtocol'

interface PendingRequest {
  resolve(value: unknown): void
  reject(error: Error): void
}

export interface BrowserPeerConnectionProvider extends PeerConnectionProvider {
  readonly closed: Promise<void>
}

export class BrowserRtcSession {
  private readonly connections = new Map<string, BrowserPeerConnection>()
  private readonly pending = new Map<string, PendingRequest>()
  private readonly closedSignal = Promise.withResolvers<void>()
  private nextConnectionId = 0
  private nextRequestId = 0
  private disposed = false
  readonly provider: BrowserPeerConnectionProvider

  constructor(
    private readonly port: RtcBridgePort,
    private readonly onClosed: () => void,
    private readonly createMessageChannel: () => RtcBridgeMessageChannel,
  ) {
    this.provider = {
      createPeerConnection: (configuration) => this.createPeerConnection(configuration),
      closed: this.closedSignal.promise,
    }
    port.on('message', (event) => this.handle(event.data as RtcConnectionEvent, event.ports))
    port.on('close', () => this.close())
    port.start()
  }

  createPeerConnection(configuration: RTCConfiguration) {
    if (this.disposed) throw new Error('multiplayer_rtc_provider_closed')
    const id = `rtc-${++this.nextConnectionId}`
    const connection = new BrowserPeerConnection(this, id, configuration)
    this.connections.set(id, connection)
    this.post({ type: 'create', connectionId: id, configuration })
    return connection as unknown as RTCPeerConnection
  }

  request(connectionId: string, operation: Extract<RtcConnectionCommand, { type: 'request' }>['operation'], payload?: unknown) {
    if (this.disposed) return Promise.reject(new Error('multiplayer_rtc_provider_closed'))
    const requestId = `request-${++this.nextRequestId}`
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject })
      this.post({ type: 'request', requestId, connectionId, operation, ...(payload === undefined ? {} : { payload }) } as RtcConnectionCommand)
    })
  }

  createDataChannel(connectionId: string, channelId: string, label: string, options?: RTCDataChannelInit) {
    const { port1, port2 } = this.createMessageChannel()
    this.post({ type: 'create-data-channel', connectionId, channelId, label, options }, [port1])
    return port2
  }

  closeConnection(connectionId: string) {
    this.connections.delete(connectionId)
    if (!this.disposed) this.post({ type: 'close', connectionId })
  }

  close() {
    if (this.disposed) return
    this.disposed = true
    this.onClosed()
    for (const request of this.pending.values()) request.reject(new Error('multiplayer_rtc_provider_closed'))
    this.pending.clear()
    for (const connection of this.connections.values()) connection.providerClosed()
    this.connections.clear()
    this.port.close()
    this.closedSignal.resolve()
  }

  private post(message: RtcConnectionCommand, ports: RtcBridgePort[] = []) {
    this.port.postMessage(message, ports)
  }

  private handle(message: RtcConnectionEvent, ports: RtcBridgePort[]) {
    if (!message || typeof message !== 'object') return
    if (message.type === 'response') {
      const request = this.pending.get(message.requestId)
      if (!request) return
      this.pending.delete(message.requestId)
      if (message.ok) request.resolve(message.value)
      else request.reject(new Error(message.error))
      return
    }
    if (message.type === 'error') {
      if (message.connectionId) this.connections.get(message.connectionId)?.bridgeError(message.error)
      return
    }
    const connection = this.connections.get(message.connectionId)
    if (!connection) {
      for (const port of ports) port.close()
      return
    }
    if (message.type === 'state') connection.updateState(message)
    else if (message.type === 'ice-candidate') connection.emitIceCandidate(message.candidate)
    else if (message.type === 'data-channel') {
      const port = ports[0]
      if (port) connection.acceptDataChannel(message.channelId, message.label, message.protocol, port)
    }
  }
}

class BrowserPeerConnection extends EventTarget {
  connectionState: RTCPeerConnectionState = 'new'
  iceConnectionState: RTCIceConnectionState = 'new'
  iceGatheringState: RTCIceGatheringState = 'new'
  signalingState: RTCSignalingState = 'stable'
  readonly sctp = { maxMessageSize: 65_535 }
  private nextChannelId = 0
  private closed = false

  constructor(
    private readonly session: BrowserRtcSession,
    readonly id: string,
    private readonly configuration: RTCConfiguration,
  ) {
    super()
  }

  createOffer(options?: RTCOfferOptions) {
    return this.session.request(this.id, 'create-offer', options) as Promise<RTCSessionDescriptionInit>
  }

  createAnswer() {
    return this.session.request(this.id, 'create-answer') as Promise<RTCSessionDescriptionInit>
  }

  async setLocalDescription(description: RTCSessionDescriptionInit) {
    await this.session.request(this.id, 'set-local-description', normalizeDescription(description))
  }

  async setRemoteDescription(description: RTCSessionDescriptionInit) {
    await this.session.request(this.id, 'set-remote-description', normalizeDescription(description))
  }

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    await this.session.request(this.id, 'add-ice-candidate', {
      candidate: candidate.candidate ?? '',
      sdpMid: candidate.sdpMid ?? null,
    } satisfies RtcCandidate)
  }

  async getStats() {
    const entries = await this.session.request(this.id, 'get-stats') as RtcStatsEntry[]
    return new Map(entries.map((entry) => [entry.id, entry])) as unknown as RTCStatsReport
  }

  getConfiguration() {
    return this.configuration
  }

  createDataChannel(label: string, options?: RTCDataChannelInit) {
    const channelId = `${this.id}-channel-${++this.nextChannelId}`
    const port = this.session.createDataChannel(this.id, channelId, label, options)
    return new BrowserRtcDataChannel(channelId, label, options?.protocol ?? '', port) as unknown as RTCDataChannel
  }

  close() {
    if (this.closed) return
    this.closed = true
    this.connectionState = 'closed'
    this.session.closeConnection(this.id)
    this.dispatchEvent(new Event('connectionstatechange'))
  }

  updateState(state: Extract<RtcConnectionEvent, { type: 'state' }>) {
    const connectionChanged = this.connectionState !== state.connectionState
    const iceConnectionChanged = this.iceConnectionState !== state.iceConnectionState
    const iceGatheringChanged = this.iceGatheringState !== state.iceGatheringState
    const signalingChanged = this.signalingState !== state.signalingState
    this.connectionState = state.connectionState
    this.iceConnectionState = state.iceConnectionState
    this.iceGatheringState = state.iceGatheringState
    this.signalingState = state.signalingState
    if (state.maxMessageSize) this.sctp.maxMessageSize = state.maxMessageSize
    if (connectionChanged) this.dispatchEvent(new Event('connectionstatechange'))
    if (iceConnectionChanged) this.dispatchEvent(new Event('iceconnectionstatechange'))
    if (iceGatheringChanged) this.dispatchEvent(new Event('icegatheringstatechange'))
    if (signalingChanged) this.dispatchEvent(new Event('signalingstatechange'))
  }

  emitIceCandidate(candidate: RtcCandidate | null) {
    const value = candidate
      ? { ...candidate, toJSON: () => ({ ...candidate }) }
      : null
    this.dispatchEvent(Object.assign(new Event('icecandidate'), { candidate: value }))
  }

  acceptDataChannel(channelId: string, label: string, protocol: string, port: RtcBridgePort) {
    const channel = new BrowserRtcDataChannel(channelId, label, protocol, port)
    this.dispatchEvent(Object.assign(new Event('datachannel'), { channel }))
  }

  bridgeError(message: string) {
    this.dispatchEvent(Object.assign(new Event('error'), { error: new Error(message) }))
  }

  providerClosed() {
    if (this.closed) return
    this.closed = true
    this.connectionState = 'closed'
    this.dispatchEvent(new Event('connectionstatechange'))
  }
}

class BrowserRtcDataChannel {
  bufferedAmount = 0
  readyState: RTCDataChannelState = 'connecting'
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onbufferedamountlow: ((event: Event) => void) | null = null
  onclose: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  private currentBinaryType: BinaryType = 'arraybuffer'
  private currentBufferedAmountLowThreshold = 0

  constructor(
    readonly id: string,
    readonly label: string,
    readonly protocol: string,
    private readonly port: RtcBridgePort,
  ) {
    port.on('message', ({ data }) => this.handle(data as RtcDataChannelEvent))
    port.on('close', () => this.finishClose())
    port.start()
  }

  get binaryType() {
    return this.currentBinaryType
  }

  set binaryType(value: BinaryType) {
    this.currentBinaryType = value
    this.post({ type: 'set-binary-type', value })
  }

  get bufferedAmountLowThreshold() {
    return this.currentBufferedAmountLowThreshold
  }

  set bufferedAmountLowThreshold(value: number) {
    this.currentBufferedAmountLowThreshold = value
    this.post({ type: 'set-buffered-amount-low-threshold', value })
  }

  send(data: string | ArrayBuffer | ArrayBufferView) {
    if (this.readyState !== 'open') throw new Error('RTCDataChannel is not open')
    const value = typeof data === 'string' ? data : copyArrayBuffer(data)
    this.bufferedAmount += typeof value === 'string'
      ? new TextEncoder().encode(value).byteLength
      : value.byteLength
    this.post({ type: 'send', data: value })
  }

  close() {
    if (this.readyState === 'closed') return
    this.readyState = 'closing'
    this.post({ type: 'close' })
  }

  private post(message: RtcDataChannelCommand) {
    this.port.postMessage(message)
  }

  private handle(message: RtcDataChannelEvent) {
    if (!message || typeof message !== 'object') return
    if (message.type === 'state') {
      const wasAboveThreshold = this.bufferedAmount > this.bufferedAmountLowThreshold
      this.readyState = message.readyState
      this.bufferedAmount = message.bufferedAmount
      if (wasAboveThreshold && this.bufferedAmount <= this.bufferedAmountLowThreshold) {
        this.onbufferedamountlow?.(new Event('bufferedamountlow'))
      }
    } else if (message.type === 'open') {
      this.readyState = 'open'
      this.onopen?.(new Event('open'))
    } else if (message.type === 'message') {
      this.onmessage?.(new MessageEvent('message', { data: message.data }))
    } else if (message.type === 'buffered-amount-low') {
      this.bufferedAmount = message.bufferedAmount
      this.onbufferedamountlow?.(new Event('bufferedamountlow'))
    } else if (message.type === 'error') {
      this.onerror?.(Object.assign(new Event('error'), { error: new Error(message.error) }))
    } else if (message.type === 'close') {
      this.finishClose()
    }
  }

  private finishClose() {
    if (this.readyState === 'closed') return
    this.readyState = 'closed'
    this.port.close()
    this.onclose?.(new Event('close'))
  }
}

function normalizeDescription(description: RTCSessionDescriptionInit): RtcDescription {
  return { type: description.type, ...(description.sdp === undefined ? {} : { sdp: description.sdp }) }
}

function copyArrayBuffer(data: ArrayBuffer | ArrayBufferView) {
  if (data instanceof ArrayBuffer) return data.slice(0)
  return Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).buffer
}
