export const browserRtcAttachChannel = 'multiplayer-rtc-attach'

export type RtcDescription = Pick<RTCSessionDescriptionInit, 'type' | 'sdp'>

export interface RtcBridgePort {
  postMessage(message: unknown, ports?: RtcBridgePort[]): void
  close(): void
  start(): void
  on(event: 'message', listener: (event: { data: unknown; ports: RtcBridgePort[] }) => void): unknown
  on(event: 'close', listener: () => void): unknown
}

export interface RtcBridgeMessageChannel {
  port1: RtcBridgePort
  port2: RtcBridgePort
}

export interface RtcCandidate {
  candidate: string
  sdpMid: string | null
}

export interface RtcStatsEntry {
  id: string
  [key: string]: unknown
}

export type RtcConnectionCommand =
  | { type: 'create'; connectionId: string; configuration: RTCConfiguration }
  | { type: 'request'; requestId: string; connectionId: string; operation: 'create-offer'; payload?: RTCOfferOptions }
  | { type: 'request'; requestId: string; connectionId: string; operation: 'create-answer' }
  | { type: 'request'; requestId: string; connectionId: string; operation: 'set-local-description'; payload: RtcDescription }
  | { type: 'request'; requestId: string; connectionId: string; operation: 'set-remote-description'; payload: RtcDescription }
  | { type: 'request'; requestId: string; connectionId: string; operation: 'add-ice-candidate'; payload: RtcCandidate }
  | { type: 'request'; requestId: string; connectionId: string; operation: 'get-stats' }
  | { type: 'create-data-channel'; connectionId: string; channelId: string; label: string; options?: RTCDataChannelInit }
  | { type: 'close'; connectionId: string }

export type RtcConnectionEvent =
  | { type: 'response'; requestId: string; ok: true; value?: RtcDescription | RtcStatsEntry[] }
  | { type: 'response'; requestId: string; ok: false; error: string }
  | {
      type: 'state'
      connectionId: string
      connectionState: RTCPeerConnectionState
      iceConnectionState: RTCIceConnectionState
      iceGatheringState: RTCIceGatheringState
      signalingState: RTCSignalingState
      maxMessageSize?: number
    }
  | { type: 'ice-candidate'; connectionId: string; candidate: RtcCandidate | null }
  | { type: 'data-channel'; connectionId: string; channelId: string; label: string; protocol: string }
  | { type: 'error'; connectionId?: string; error: string }

export type RtcDataChannelCommand =
  | { type: 'send'; data: string | ArrayBuffer }
  | { type: 'set-binary-type'; value: BinaryType }
  | { type: 'set-buffered-amount-low-threshold'; value: number }
  | { type: 'close' }

export type RtcDataChannelEvent =
  | { type: 'state'; readyState: RTCDataChannelState; bufferedAmount: number }
  | { type: 'open' }
  | { type: 'message'; data: string | ArrayBuffer }
  | { type: 'buffered-amount-low'; bufferedAmount: number }
  | { type: 'close' }
  | { type: 'error'; error: string }