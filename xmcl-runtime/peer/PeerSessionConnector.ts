import { RTCSessionDescription } from '@xmcl/runtime-api'
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
  iceCandidates: Array<{ candidate: string; mid: string }>
  signal: Promise<boolean>
  ready: boolean
  turnserver?: RTCIceServer
  latency: number
}

export class PeerSessionConnector {
  #connections: Record<string, Candidate> = {}

  #updateDescriptor: () => void

  #busy = false

  constructor(
    sessionId: string,
    private context: PeerContext
  ) {
    this.#updateDescriptor = debounce(() => {
      context.onDescriptorUpdate(sessionId, Object.values(this.#connections).map((can) => ({
        id: can.id,
        sdp: can.connection.localDescription!.sdp,
        type: can.connection.localDescription!.type,
        tunserver: can.turnserver,
        candidates: can.iceCandidates,
      })))
    }, 1500) // debounce for 1.5 second
  }

  close() {
    for (const conn of Object.values(this.#connections)) {
      conn.connection.close()
    }
    this.#connections = {}
  }

  #createConnection(ices: RTCIceServer[]) {
    const id = randomUUID()
    const co = this.context.createConnection(ices, undefined)
    const signal = new Promise<boolean>((resolve) => {
      co.onconnectionstatechange = () => {
        if (co.connectionState === 'connected') {
          resolve(true)
        } else if (co.connectionState === 'closed' || co.connectionState === 'disconnected' || co.connectionState === 'failed') {
          resolve(false)
        }
      }
    })
    const can: Candidate = {
      id,
      connection: co,
      iceCandidates: [],
      latency: Number.MAX_SAFE_INTEGER,
      ready: false,
      turnserver: ices.find(ic => ic.credential),
      signal,
    }
    co.addEventListener('icecandidate', (ev) => {
      const candidate = ev.candidate?.toJSON()
      if (candidate && candidate.candidate) {
        can.iceCandidates.push({
          candidate: candidate.candidate,
          mid: candidate.sdpMid ?? '',
        })
      }
      this.#updateDescriptor()
    })
    this.#connections[id] = can
    return can
  }

  async connect() {
    if (this.#busy) {
      throw new TypeError('PendingConnections is busy')
    }
    this.#busy = true
    const servers = this.context.getIceServerCandidates()
    for (const ices of servers) {
      const can = this.#createConnection(ices)
      const co = can.connection
      const channel = co.createDataChannel('ping', {
        ordered: true,
        protocol: 'ping'
      })
      channel.onopen = () => {
        channel.send(`ping:${Date.now()}`)
      }
      channel.onmessage = (ev) => {
        if (typeof ev.data === 'string') {
          if (ev.data.startsWith('ping:')) {
            const time = Number.parseInt(ev.data.substring(5))
            channel.send(`pong:${time}`)
          } else if (ev.data.startsWith('pong:')) {
            const time = Number.parseInt(ev.data.substring(5))
            const latency = Date.now() - time
            can.latency = latency
          }
        }
      }
      co.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      }).then((offer) => {
        co.setLocalDescription(offer).then(() => {
          this.#updateDescriptor()
        })
      })
    }

    const connections = Object.values(this.#connections)
    await Promise.race(connections.map((can) => can.signal))
    // wait for 5 seconds for other peers
    await setTimeout(5000)
    // pick the lowest latency
    const selected = connections.filter(c => c.ready).reduce((prev, curr) => {
      if (!prev) {
        return curr
      }
      return prev.latency < curr.latency ? prev : curr
    }, undefined as Candidate | undefined)

    if (selected) {
      console.log(`Selected ${selected.id} with latency ${selected.latency}`)
      delete this.#connections[selected.id]
    }

    for (const conn of Object.values(this.#connections)) {
      conn.connection.close()
    }
    this.#connections = {}

    this.#busy = false

    return selected?.connection
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
        conn = this.#createConnection(servers[i % servers.length])
      }
      // const sState = conn.connection.signalingState
      // if ((sState === 'stable' || sState === 'have-local-offer')) {
      //   return
      // }

      for (const c of d.candidates) {
        conn.connection.addIceCandidate(c)
      }

      if (type === 'offer') {
        console.log(`Set remote offer ${type} ${sdp}`)
        conn.connection.setRemoteDescription({
          type,
          sdp,
        })
        const answer = await conn.connection.createAnswer()

        console.log(`Set local description ${answer.type} ${answer.sdp}`)
        await conn.connection.setLocalDescription(answer)

        this.#updateDescriptor()
      } else if (type === 'answer') {
        console.log(`Set remote to ${type} as answer`)
        console.log(sdp)
        await conn.connection.setRemoteDescription({
          type,
          sdp,
        })
      }
    }
  }
}
