import {
  type RtcConnectionCommand,
  type RtcConnectionEvent,
  type RtcDataChannelCommand,
  type RtcDataChannelEvent,
  type RtcDescription,
  type RtcStatsEntry,
} from './BrowserRtcProtocol'

export function hostBrowserRtc(control: MessagePort) {
  const connections = new Map<string, RTCPeerConnection>()
  let nextRemoteChannelId = 0
  control.onmessage = ({ data, ports }: MessageEvent<RtcConnectionCommand>) => {
    if (!data || typeof data !== 'object') return
    void handle(data, ports).catch((error) => {
      if (data.type === 'request') {
        post({
          type: 'response',
          requestId: data.requestId,
          ok: false,
          error: safeError(error),
        })
      } else {
        post({
          type: 'error',
          connectionId: 'connectionId' in data ? data.connectionId : undefined,
          error: safeError(error),
        })
      }
    })
  }
  control.onmessageerror = closeAll
  control.start()

  async function handle(command: RtcConnectionCommand, ports: readonly MessagePort[]) {
    if (command.type === 'create') {
      const connection = new RTCPeerConnection(command.configuration)
      connections.set(command.connectionId, connection)
      bindConnection(command.connectionId, connection)
      publishState(command.connectionId, connection)
      return
    }
    const connection = connections.get(command.connectionId)
    if (!connection) throw new Error('multiplayer_rtc_connection_missing')
    if (command.type === 'close') {
      connections.delete(command.connectionId)
      connection.close()
      return
    }
    if (command.type === 'create-data-channel') {
      const port = ports[0]
      if (!port) throw new Error('multiplayer_rtc_channel_port_missing')
      bridgeDataChannel(connection.createDataChannel(command.label, command.options), port)
      return
    }
    try {
      let value: RtcDescription | RtcStatsEntry[] | undefined
      if (command.operation === 'create-offer') {
        value = normalizeDescription(await connection.createOffer(command.payload))
      } else if (command.operation === 'create-answer') {
        value = normalizeDescription(await connection.createAnswer())
      } else if (command.operation === 'set-local-description') {
        await connection.setLocalDescription(command.payload)
      } else if (command.operation === 'set-remote-description') {
        await connection.setRemoteDescription(command.payload)
      } else if (command.operation === 'add-ice-candidate') {
        await connection.addIceCandidate(command.payload)
      } else if (command.operation === 'get-stats') {
        value = Array.from((await connection.getStats()).values()).map(serializeStats)
      }
      post({ type: 'response', requestId: command.requestId, ok: true, value })
    } catch (error) {
      post({ type: 'response', requestId: command.requestId, ok: false, error: safeError(error) })
    }
  }

  function bindConnection(connectionId: string, connection: RTCPeerConnection) {
    const state = () => publishState(connectionId, connection)
    connection.addEventListener('connectionstatechange', state)
    connection.addEventListener('iceconnectionstatechange', state)
    connection.addEventListener('icegatheringstatechange', state)
    connection.addEventListener('signalingstatechange', state)
    connection.addEventListener('icecandidate', ({ candidate }) => {
      post({
        type: 'ice-candidate',
        connectionId,
        candidate: candidate
          ? { candidate: candidate.candidate, sdpMid: candidate.sdpMid }
          : null,
      })
    })
    connection.addEventListener('datachannel', ({ channel }) => {
      const bridge = new MessageChannel()
      bridgeDataChannel(channel, bridge.port1)
      control.postMessage(
        {
          type: 'data-channel',
          connectionId,
          channelId: `${connectionId}-remote-${nextRemoteChannelId++}`,
          label: channel.label,
          protocol: channel.protocol,
        } satisfies RtcConnectionEvent,
        [bridge.port2],
      )
    })
  }

  function publishState(connectionId: string, connection: RTCPeerConnection) {
    post({
      type: 'state',
      connectionId,
      connectionState: connection.connectionState,
      iceConnectionState: connection.iceConnectionState,
      iceGatheringState: connection.iceGatheringState,
      signalingState: connection.signalingState,
      maxMessageSize: connection.sctp?.maxMessageSize,
    })
  }

  function post(message: RtcConnectionEvent) {
    control.postMessage(message)
  }

  function closeAll() {
    for (const connection of connections.values()) connection.close()
    connections.clear()
  }

  return closeAll
}

function bridgeDataChannel(channel: RTCDataChannel, port: MessagePort) {
  let openPublished = false
  const post = (message: RtcDataChannelEvent) => port.postMessage(message)
  const publishState = () => post({
    type: 'state',
    readyState: channel.readyState,
    bufferedAmount: channel.bufferedAmount,
  })
  port.onmessage = ({ data }: MessageEvent<RtcDataChannelCommand>) => {
    if (!data || typeof data !== 'object') return
    try {
      if (data.type === 'send') {
        if (typeof data.data === 'string') channel.send(data.data)
        else channel.send(data.data)
      }
      else if (data.type === 'set-binary-type') channel.binaryType = data.value
      else if (data.type === 'set-buffered-amount-low-threshold') {
        channel.bufferedAmountLowThreshold = data.value
      } else if (data.type === 'close') channel.close()
      if (data.type === 'send') publishState()
    } catch (error) {
      post({ type: 'error', error: safeError(error) })
    }
  }
  port.onmessageerror = () => channel.close()
  port.start()
  channel.binaryType = 'arraybuffer'
  const publishOpen = () => {
    if (openPublished) return
    openPublished = true
    publishState()
    post({ type: 'open' })
  }
  channel.onopen = publishOpen
  channel.onmessage = ({ data }) => {
    post({ type: 'message', data: typeof data === 'string' ? data : copyArrayBuffer(data) })
  }
  channel.onbufferedamountlow = () => {
    post({ type: 'buffered-amount-low', bufferedAmount: channel.bufferedAmount })
  }
  channel.onerror = () => post({ type: 'error', error: 'multiplayer_rtc_channel_error' })
  channel.onclose = () => {
    publishState()
    post({ type: 'close' })
    port.close()
  }
  publishState()
  if (channel.readyState === 'open') publishOpen()
}

function normalizeDescription(description: RTCSessionDescriptionInit): RtcDescription {
  return { type: description.type, ...(description.sdp === undefined ? {} : { sdp: description.sdp }) }
}

function serializeStats(entry: RTCStats): RtcStatsEntry {
  return Object.fromEntries(Object.entries(entry)) as RtcStatsEntry
}

function copyArrayBuffer(data: unknown) {
  if (data instanceof ArrayBuffer) return data.slice(0)
  if (ArrayBuffer.isView(data)) {
    return Uint8Array.from(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).buffer
  }
  throw new Error('multiplayer_rtc_channel_invalid_binary_data')
}

function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 512) : String(error).slice(0, 512)
}
