import { randomUUID } from 'crypto'
import debounce from 'lodash.debounce'
import { PeerContext, RTCPeerConnectionData } from './PeerContext'
import { setTimeout } from 'timers/promises'


interface Candidate {
  /**
   * The connection id
   */
  id: string
  connection: RTCPeerConnection
  channel: RTCDataChannel | undefined
  iceCandidates: Array<{ candidate: string; mid: string }>
  signal: Promise<boolean>
  turnserver?: RTCIceServer
  latency: number
}

function isFinished(can: Candidate) {
  return can.connection.connectionState === 'connected' || can.connection.connectionState === 'disconnected' || can.connection.connectionState === 'failed' || can.connection.connectionState === 'closed'
}

function isFailed(can: Candidate) {
  return can.connection.connectionState === 'disconnected' || can.connection.connectionState === 'failed' || can.connection.connectionState === 'closed'
}

function isConnected(can: Candidate) {
  return can.connection.connectionState === 'connected'
}

export class PeerSessionConnector {
  #connections: Record<string, Candidate> = {}

  #updateDescriptor: () => void

  #busy = false
  #firstConnected = Promise.withResolvers<void>()
  #winner = Promise.withResolvers<Candidate | undefined>()

  constructor(
    sessionId: string,
    private context: PeerContext
  ) {
    this.#updateDescriptor = debounce(() => {
      context.onDescriptorUpdate(sessionId, Object.values(this.#connections)
        .filter(c => c.connection.connectionState === 'connecting' || c.connection.connectionState === 'new')
        .map((can) => ({
          id: can.id,
          sdp: can.connection.localDescription!.sdp,
          type: can.connection.localDescription!.type,
          tunserver: can.turnserver,
          candidates: can.iceCandidates,
        })))
    }, 1500) // debounce for 1.5 second
  }

  #handleMessage(can: Candidate, channel: RTCDataChannel, ev: MessageEvent<any>) {
    if (typeof ev.data === 'string') {
      if (ev.data.startsWith('ping:')) {
        const time = Number.parseInt(ev.data.substring(5))
        channel.send(`pong:${time}`)
      } else if (ev.data.startsWith('pong:')) {
        const time = Number.parseInt(ev.data.substring(5))
        const latency = Date.now() - time
        can.latency = latency
      } else if (ev.data === 'selected' && !this.context.isMaster()) {
        this.#winner.resolve(can)
      }
    }
  }

  close() {
    for (const conn of Object.values(this.#connections)) {
      conn.connection.close()
    }
    this.#connections = {}
  }

  #onFinished() {
    if (Object.values(this.#connections).every(d => isFailed(d))) {
      this.#winner.resolve(undefined)
    }
  }

  #onPeerClose() {
    const connected = Object.values(this.#connections).filter(c => isConnected(c))
    if (connected.length === 1) {
      this.#winner.resolve(connected[0])
    }
  }

  #createConnection(ices: RTCIceServer[], id = randomUUID() as string) {
    const co = this.context.createConnection(ices, undefined)
    let lastConnectionState = co.connectionState
    const signal = new Promise<boolean>((resolve) => {
      co.onconnectionstatechange = () => {
        console.log(id, 'onconnectionstatechange', lastConnectionState + '->' + co.connectionState)
        if (co.connectionState === 'connected') {
          this.#firstConnected.resolve()
          resolve(true)
          this.#onFinished()
        } else if (co.connectionState === 'closed' || co.connectionState === 'disconnected' || co.connectionState === 'failed') {
          if (lastConnectionState === 'connected' || lastConnectionState === 'closed') {
            // connection is closed by peer
            this.#onPeerClose()
          }
          resolve(false)
          this.#onFinished()
        }
        lastConnectionState = co.connectionState
      }
    })
    const can: Candidate = {
      id,
      connection: co,
      iceCandidates: [],
      latency: Number.MAX_SAFE_INTEGER,
      turnserver: ices.find(ic => ic.credential),
      channel: undefined,
      signal,
    }
    co.addEventListener('signalingstatechange', () => {
      console.log(id, 'signalingstatechange', co.signalingState)
      if (co.signalingState === 'have-local-offer' || co.signalingState === 'have-remote-offer') {
        this.#updateDescriptor()
      }
    })
    co.addEventListener('icegatheringstatechange', (ev) => {
      console.log(id, 'icegatheringstatechange', co.iceGatheringState)
    })
    co.addEventListener('icecandidate', (ev) => {
      const candidate = ev.candidate?.toJSON()
      if (candidate && candidate.candidate) {
        can.iceCandidates.push({
          candidate: candidate.candidate,
          mid: candidate.sdpMid ?? '',
        })
      }
      console.log(id, 'icecandidate', candidate)
      this.#updateDescriptor()
    })
    this.#connections[id] = can
    return can
  }

  async connect() {
    if (this.#busy) {
      return this.#winner.promise
    }
    this.#busy = true
    this.#firstConnected = Promise.withResolvers<void>()
    this.#winner = Promise.withResolvers<Candidate | undefined>()
    this.#winner.promise = this.#winner.promise.then((selected) => {
      if (selected) {
        console.log(`Selected ${selected.id} with latency ${selected.latency}`)
        delete this.#connections[selected.id]
      }
      if (this.context.isMaster()) {
        for (const conn of Object.values(this.#connections)) {
          conn.connection.close()
        }
      }
      this.#connections = {}
      this.#busy = false
      if (this.context.isMaster()) {
        selected?.channel?.send('selected')
      }
      return selected
    })

    if (this.context.isMaster()) {
      this.#firstConnected.promise.then(() => {
        return setTimeout(5000)
      }).then(() => {
        const selected = Object.values(this.#connections).filter(c => isConnected(c) && c.channel && c.channel.readyState === 'open').reduce((prev, curr) => {
          if (!prev) {
            return curr
          }
          return prev.latency < curr.latency ? prev : curr
        }, undefined as Candidate | undefined)
        this.#winner.resolve(selected)
      })
    }

    const servers = this.context.getIceServerCandidates()
    for (const ices of servers) {
      const can = this.#createConnection(ices)
      const co = can.connection
      const channel = co.createDataChannel('ping', {
        ordered: true,
        protocol: 'ping'
      })
      can.channel = channel
      channel.onopen = () => {
        channel.send(`ping:${Date.now()}`)
      }
      channel.onmessage = (ev) => {
        this.#handleMessage(can, channel, ev)
      }
      co.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      }).then((offer) => {
        co.setLocalDescription(offer)
      })
      if (!this.context.isMaster()) {
      }
    }

    return this.#winner.promise
  }

  async setRemoteDescription(connectionData: RTCPeerConnectionData[]) {
    if (!this.#busy) {
      return
    }
    const servers = this.context.getIceServerCandidates()
    for (let i = 0; i < connectionData.length; i++) {
      const d = connectionData[i]
      const id = d.id
      const type = d.type
      const sdp = d.sdp
      let conn = this.#connections[id]
      if (!conn) {
        conn = this.#createConnection(servers[i % servers.length], d.id)
        conn.connection.ondatachannel = (ev) => {
          const channel = ev.channel
          conn.channel = channel
          channel.onopen = () => {
            channel.send(`ping:${Date.now()}`)
          }
          channel.onmessage = (ev) => {
            this.#handleMessage(conn, channel, ev)
          }
        }
      }
      if (!conn.connection.remoteDescription || !conn.connection.remoteDescription.type) {
        console.log(`Set remote offer ${type} ${sdp}`)
        await conn.connection.setRemoteDescription({
          type: type as any,
          sdp,
        })
      }
      if (type === 'offer') {
        if (!conn.connection.localDescription || !conn.connection.localDescription.type) {
          const answer = await conn.connection.createAnswer()
          console.log(`Set local description ${answer.type} ${answer.sdp}`)
          await conn.connection.setLocalDescription(answer)
        }
      }

      for (const c of d.candidates) {
        conn.connection.addIceCandidate({
          candidate: c.candidate,
          sdpMid: c.mid,
        })
      }
    }
  }
}
