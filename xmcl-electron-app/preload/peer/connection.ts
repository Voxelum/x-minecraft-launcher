import { ConnectionUserInfo, RTCSessionDescription } from '@xmcl/runtime-api'
import { createHash } from 'crypto'
import { ipcRenderer } from 'electron'
import { createWriteStream } from 'fs'
import { ensureFile, unlink } from 'fs-extra'
import { createConnection } from 'net'
import { TransferDescription } from '../peer'
import { MessageHeartbeatPing } from './messages/heartbeat'
import { MessageIdentity } from './messages/identity'
import { MessageType } from './messages/message'
import { PeerHost } from './PeerHost'
import { ServerProxy } from './ServerProxy'
import { iceServers } from './stun'

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
        // this is a minecraft game connection
        const port = Number.parseInt(channel.label)!
        console.log(`Receive minecraft game connection: ${port}`)
        const socket = createConnection(port)
        socket.on('data', (buf) => channel.send(buf))
        channel.addEventListener('message', ({ data }) => socket.write(Buffer.from(data)))
        socket.on('close', () => channel.close())
        channel.addEventListener('close', () => socket.destroy())
        console.log(`Create game channel to ${port}`)
      } else if (channel.protocol === 'metadata') {
        // this is a metadata channel
        this.setChannel(e.channel)
        console.log('Metadata channel created')
      } else if (channel.protocol === 'download') {
        console.log(`Receive peer file request: ${channel.label}`)
        let fileName = unescape(channel.label)
        if (fileName.startsWith('/')) {
          fileName = fileName.substring(1)
        }
        if (!this.host.isFileShared(fileName)) {
          // reject the file
          console.log(`Reject peer file request as it's not shared: ${fileName}`)
          channel.close()
        } else {
          console.log(`Process peer file request: ${fileName}`)
          const filePath = fileName
          this.host.createSharedFileReadStream(filePath).on('data', (data: Buffer) => {
            channel.send(data)
          })
          channel.addEventListener('message', (ev) => {
            if (ev.data === 'done') {
              channel.close()
            }
          })
        }
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
    console.log(`Update local description: ${d?.sdp}`)
  }

  setRemoteIdentity(remoteId: string, info: ConnectionUserInfo) {
    console.log(`Set remote identity: ${remoteId}, ${info.name}`)
    ipcRenderer.send('identity', { id: this.id, info: info })
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
    console.log(`Set remote to ${remoteAnswer.type} as answer`)
    console.log(remoteAnswer.sdp)
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

  async download(file: string, dest: string, sha1: string, total: number, downloadId: number) {
    const channel = this.connection.createDataChannel(file, {
      protocol: 'download',
    })

    console.log(`start to download ${file} to ${dest} in ${sha1}`)
    await ensureFile(dest)
    const output = createWriteStream(dest)
    const hash = createHash('sha1')
    let length = 0

    ipcRenderer.on('download-abort-internal', (ev, id: number) => {
      if (id === downloadId) {
        channel.send('done')
        channel.close()
      }
    })
    await new Promise<void>((resolve, reject) => {
      channel.addEventListener('message', (ev) => {
        const buf = Buffer.from(ev.data)
        length += buf.length
        console.log(`Get download buffer ${buf.length}`)
        hash.update(buf)
        output.write(buf)
        if (length >= total) {
          console.log(`done ${total} ${length}`)
          channel.send('done')
          channel.close()
        }
        ipcRenderer.send('download-progress', { id: downloadId, chunkSize: ev.data.length })
      })
      channel.addEventListener('error', (e) => {
        reject(e)
      })
      channel.addEventListener('close', () => {
        output.end(resolve)
      })
    })
    const actualSha1 = hash.digest('hex')
    console.log(`Sha1 not match! ${actualSha1} vs ${sha1}`)
    if (sha1) {
      if (actualSha1 !== sha1) {
        // noop
        await unlink(dest)
        return false
      }
    }
    return true
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
        this.send(MessageIdentity, { remoteId: this.host.id, ...info })
      })
      if (!this.remoteId) {
        console.error(`Illegal State! remote is is not set when channel is opened! ${this.id}`)
      } else {
        // propagate this new peer to other neighbor
        // const neighbor = Object.values(this.host.connections).filter((conn) => conn.id !== this.id)
        // console.log(`Broadcast this peer to other ${neighbor.length} neighbor`)
        // for (const conn of neighbor) {
        //   conn.send(MessageMemberJoin, { id: this.remoteId })
        // }
      }
    })
    this.channel = channel
    setInterval(() => {
      this.send(MessageHeartbeatPing, { time: Date.now() })
    }, 1000)
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
