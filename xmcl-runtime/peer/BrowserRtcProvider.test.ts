import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'
import type {
  RtcConnectionCommand,
  RtcConnectionEvent,
  RtcDataChannelCommand,
  RtcDataChannelEvent,
} from './BrowserRtcProtocol'
import { BrowserRtcSession } from './BrowserRtcProvider'
import type { RtcBridgeMessageChannel } from './BrowserRtcProtocol'

class TestPort extends EventEmitter {
  peer: TestPort | undefined
  closed = false

  postMessage(data: unknown, ports: TestPort[] = []) {
    if (this.closed) throw new Error('port_closed')
    queueMicrotask(() => this.peer?.emit('message', { data, ports }))
  }

  start() {}

  close() {
    if (this.closed) return
    this.closed = true
    const peer = this.peer
    queueMicrotask(() => {
      this.emit('close')
      peer?.emit('close')
    })
  }
}

function createChannel() {
  const port1 = new TestPort()
  const port2 = new TestPort()
  port1.peer = port2
  port2.peer = port1
  return { port1, port2 }
}

function asMessageChannel(channel: ReturnType<typeof createChannel>) {
  return channel as unknown as RtcBridgeMessageChannel
}

async function nextMessage<T>(port: TestPort) {
  return new Promise<{ data: T; ports: TestPort[] }>((resolve) => port.once('message', resolve))
}

describe('BrowserRtcSession', () => {
  it('proxies descriptions, state, candidates, and stats', async () => {
    const control = createChannel()
    const session = new BrowserRtcSession(
      control.port1 as any,
      vi.fn(),
      () => asMessageChannel(createChannel()),
    )
    const connection = session.provider.createPeerConnection({ iceServers: [] })
    const create = await nextMessage<RtcConnectionCommand>(control.port2)
    expect(create.data).toMatchObject({ type: 'create', configuration: { iceServers: [] } })
    const connectionId = (create.data as Extract<RtcConnectionCommand, { type: 'create' }>).connectionId

    const offerPromise = connection.createOffer({ iceRestart: true })
    const offerRequest = await nextMessage<RtcConnectionCommand>(control.port2)
    expect(offerRequest.data).toMatchObject({
      type: 'request',
      connectionId,
      operation: 'create-offer',
      payload: { iceRestart: true },
    })
    const requestId = (offerRequest.data as Extract<RtcConnectionCommand, { type: 'request' }>).requestId
    control.port2.postMessage({
      type: 'response',
      requestId,
      ok: true,
      value: { type: 'offer', sdp: 'offer-sdp' },
    } satisfies RtcConnectionEvent)
    await expect(offerPromise).resolves.toEqual({ type: 'offer', sdp: 'offer-sdp' })

    const stateChanged = vi.fn()
    const candidateReceived = vi.fn()
    connection.addEventListener('connectionstatechange', stateChanged)
    connection.addEventListener('icecandidate', candidateReceived)
    control.port2.postMessage({
      type: 'state',
      connectionId,
      connectionState: 'connected',
      iceConnectionState: 'connected',
      iceGatheringState: 'complete',
      signalingState: 'stable',
      maxMessageSize: 32_768,
    } satisfies RtcConnectionEvent)
    control.port2.postMessage({
      type: 'ice-candidate',
      connectionId,
      candidate: { candidate: 'candidate:1', sdpMid: '0' },
    } satisfies RtcConnectionEvent)
    await vi.waitFor(() => expect(stateChanged).toHaveBeenCalledOnce())
    expect(connection.connectionState).toBe('connected')
    expect(connection.sctp?.maxMessageSize).toBe(32_768)
    expect((candidateReceived.mock.calls[0][0] as RTCPeerConnectionIceEvent).candidate?.candidate)
      .toBe('candidate:1')

    const statsPromise = connection.getStats()
    const statsRequest = await nextMessage<RtcConnectionCommand>(control.port2)
    const statsRequestId = (statsRequest.data as Extract<RtcConnectionCommand, { type: 'request' }>).requestId
    control.port2.postMessage({
      type: 'response',
      requestId: statsRequestId,
      ok: true,
      value: [{ id: 'transport', type: 'transport', selectedCandidatePairId: 'pair' }],
    } satisfies RtcConnectionEvent)
    const stats = await statsPromise
    expect((stats as unknown as Map<string, unknown>).get('transport'))
      .toMatchObject({ selectedCandidatePairId: 'pair' })
  })

  it('uses a dedicated port for data channel flow control and binary messages', async () => {
    const control = createChannel()
    let dataChannel: ReturnType<typeof createChannel> | undefined
    const session = new BrowserRtcSession(
      control.port1 as any,
      vi.fn(),
      () => {
        dataChannel = createChannel()
        return asMessageChannel(dataChannel)
      },
    )
    const connection = session.provider.createPeerConnection({ iceServers: [] })
    await nextMessage<RtcConnectionCommand>(control.port2)

    const channel = connection.createDataChannel('files', { protocol: 'files' })
    const create = await nextMessage<RtcConnectionCommand>(control.port2)
    expect(create.data).toMatchObject({
      type: 'create-data-channel',
      label: 'files',
      options: { protocol: 'files' },
    })
    const rendererPort = create.ports[0]
    expect(rendererPort).toBe(dataChannel?.port1)

    const opened = vi.fn()
    const message = vi.fn()
    channel.onopen = opened
    channel.onmessage = message
    rendererPort.postMessage({ type: 'open' } satisfies RtcDataChannelEvent)
    await vi.waitFor(() => expect(opened).toHaveBeenCalledOnce())

    channel.bufferedAmountLowThreshold = 2
    const threshold = await nextMessage<RtcDataChannelCommand>(rendererPort)
    expect(threshold.data).toEqual({ type: 'set-buffered-amount-low-threshold', value: 2 })

    channel.send(new Uint8Array([1, 2, 3]))
    const sent = await nextMessage<RtcDataChannelCommand>(rendererPort)
    expect(sent.data.type).toBe('send')
    expect(Array.from(new Uint8Array((sent.data as Extract<RtcDataChannelCommand, { type: 'send' }>).data as ArrayBuffer)))
      .toEqual([1, 2, 3])

    const drained = vi.fn()
    channel.onbufferedamountlow = drained
    rendererPort.postMessage({
      type: 'state',
      readyState: 'open',
      bufferedAmount: 0,
    } satisfies RtcDataChannelEvent)
    await vi.waitFor(() => expect(drained).toHaveBeenCalledOnce())

    rendererPort.postMessage({
      type: 'message',
      data: new Uint8Array([4, 5, 6]).buffer,
    } satisfies RtcDataChannelEvent)
    await vi.waitFor(() => expect(message).toHaveBeenCalledOnce())
    expect(Array.from(new Uint8Array(message.mock.calls[0][0].data))).toEqual([4, 5, 6])

    channel.close()
    const close = await nextMessage<RtcDataChannelCommand>(rendererPort)
    expect(close.data).toEqual({ type: 'close' })
  })

  it('rejects pending requests when the renderer provider closes', async () => {
    const control = createChannel()
    const closed = vi.fn()
    const session = new BrowserRtcSession(
      control.port1 as any,
      closed,
      () => asMessageChannel(createChannel()),
    )
    const connection = session.provider.createPeerConnection({ iceServers: [] })
    await nextMessage<RtcConnectionCommand>(control.port2)
    const offer = connection.createOffer()
    await nextMessage<RtcConnectionCommand>(control.port2)

    control.port2.close()

    await expect(offer).rejects.toThrow('multiplayer_rtc_provider_closed')
    await expect(session.provider.closed).resolves.toBeUndefined()
    expect(closed).toHaveBeenCalledOnce()
  })
})
