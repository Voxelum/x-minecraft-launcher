import { RTCSessionDescription } from '@xmcl/runtime-api'
import { ipcRenderer } from 'electron'
import { createConnection } from 'net'
import { PeerHost } from './PeerHost'
import { MessageType } from './messages/message'
import { ServerProxy } from './ServerProxy'
import { iceServers } from './stun'
import { MessageMemberJoin } from './messages/memberJoin'
import { MessageIdentity } from './messages/identity'
import { TransferDescription } from '../peer'

export class PeerSession {
  readonly connection: RTCPeerConnection
  /**
   * The basic communicate channel
   */
  private channel: RTCDataChannel | undefined

  readonly proxies: ServerProxy[] = []

  constructor(readonly host: PeerHost,
    /**
     * The session id
     */
    readonly id: string, public remoteId?: string) {
    this.connection = new RTCPeerConnection({
      iceServers,
      iceTransportPolicy: 'all',
    })

    this.connection.addEventListener('datachannel', (e) => {
      const channel = e.channel
      if (channel.protocol === 'minecraft') {
        // this is minecraft game connection
        const port = Number.parseInt(channel.label)!
        console.log(`Receive minecraft game connection: ${port}`)
        const socket = createConnection(port)
        socket.on('data', (buf) => channel.send(buf))
        channel.addEventListener('message', ({ data }) => socket.write(Buffer.from(data)))
        socket.on('close', () => channel.close())
        channel.addEventListener('close', () => socket.destroy())
        console.log(`Create game channel to ${port}`)
      } else if (channel.protocol === 'metadata') {
        // this is metadata channel
        this.setChannel(e.channel)
        console.log('Metadata channel created')
      } else {
        // TODO: emit error for unknown protocol
      }
    })
    this.connection.addEventListener('icecandidate', () => {
      this.updateLocalDescription()
    })
    this.connection.addEventListener('connectionstatechange', () => {
      ipcRenderer.send('connectionstatechange', { id, state: this.connection.connectionState })
    })
    this.connection.addEventListener('signalingstatechange', () => {
      ipcRenderer.send('signalingstatechange', { id, state: this.connection.signalingState })
    })
    this.connection.addEventListener('icegatheringstatechange', () => {
      ipcRenderer.send('icegatheringstatechange', { id, state: this.connection.iceGatheringState })
    })
  }

  private updateLocalDescription() {
    const d = this.connection.localDescription
    const transfer: TransferDescription = {
      id: this.host.id,
      session: this.id,
      sdp: d!.sdp,
    }
    ipcRenderer.send('localDescription', transfer)
  }

  setRemoteIdentity(remoteId: string, name: string, avatar: string) {
    console.log(`Set remote identity: ${remoteId}, ${name}`)
    ipcRenderer.send('identity', { id: this.id, info: { name, avatar } })
    this.remoteId = remoteId
  }

  /**
   * Called in receiver
   */
  async offer(remoteOffer: RTCSessionDescription) {
    // get offer or answer from other
    console.log(`Set remote offer ${remoteOffer.type} ${remoteOffer.sdp}`)
    await this.connection.setRemoteDescription(remoteOffer)
    // this is the "client" peer
    const answer = await this.connection.createAnswer()

    console.log(`Set local description ${answer.type} ${answer.sdp}`)
    await this.connection.setLocalDescription(answer)

    this.updateLocalDescription()

    return this.connection.localDescription
  }

  /**
   * Called in initiator
   */
  async answer(remoteAnswer: RTCSessionDescription) {
    // get offer or answer from other
    await this.connection.setRemoteDescription(remoteAnswer)
  }

  /**
   * Called in initiator
   */
  async initiate() {
    // host
    console.log('peer initialize')
    this.setChannel(this.connection.createDataChannel(this.id, { ordered: true, protocol: 'metadata' }))

    const offer = await this.connection.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    })

    console.log(`Create offer ${(offer.sdp)}`)
    await this.connection.setLocalDescription(offer)

    this.updateLocalDescription()

    return this.connection.localDescription
  }

  waitIceGathering() {
    return new Promise<void>((resolve) => {
      if (this.connection.iceGatheringState !== 'complete') {
      // wait ice collect state done
        const onStateChange = () => {
          if (this.connection.iceGatheringState === 'complete') {
            resolve()
          }
        }
        this.connection.addEventListener('icegatheringstatechange', onStateChange)
      } else {
        resolve()
      }
    })
  }

  /**
   * Set metadata channel
   */
  private setChannel(channel: RTCDataChannel) {
    channel.addEventListener('message', async (e) => {
      const message = JSON.parse(e.data)
      this.host.handlers[message.type as string]?.call(this, message.payload)
    })
    channel.addEventListener('close', () => {
      this.close()
    })
    channel.addEventListener('open', () => {
      ipcRenderer.invoke('get-user-info').then((info) => {
        this.send(MessageIdentity, { remoteId: this.host.id, name: info.name, avatar: info.avatar })
      })
      if (!this.remoteId) {
        console.error(`Illegal State! remote is is not set when channel is opened! ${this.id}`)
      } else {
        // propagate this new peer to other neighbor
        for (const conn of Object.values(this.host.connections)) {
          if (conn.id !== this.id) {
            this.send(MessageMemberJoin, { id: this.remoteId })
          }
        }
      }
    })
    this.channel = channel
  }

  close() {
    this.connection.close()
    this.channel?.close()
    ipcRenderer.send('connectionstatechange', { id: this.id, state: 'closed' })
    for (const p of this.proxies) {
      p.server.close()
    }
  }

  send<T>(type: MessageType<T>, data: T) {
    if (this.connection.connectionState !== 'connected') {
      return
    }
    this.channel?.send(JSON.stringify({ type: type as string, payload: data }))
  }
}
