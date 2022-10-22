import EventSource from 'eventsource'
import { DescriptionType } from 'node-datachannel'
import { request } from 'undici'

export interface TransferDescription {
  session: string
  id: string
  sdp: string
}

type RelayPeerMessage = {
  type: 'HELLO'
  id: string
} | {
  type: 'CONNECT'
  receiver: string
  sender: string
} | {
  type: 'CANDIDATE'
  receiver: string
  sender: string
  candidate: string
  mid: string
} | {
  type: 'DESCRIPTOR'
  receiver: string
  sender: string
  sdp: string
  sdpType: DescriptionType
}

export class PeerGroup {
  private source: EventSource

  constructor(readonly groupId: string, readonly id: string,
    onHello: (sender: string) => void,
    onConnect: (sender: string) => void,
    onDescriptor: (sender: string, sdp: string, type: DescriptionType) => void,
    onCandidate: (sender: string, candidate: string, mid: string) => void,
  ) {
    this.source = new EventSource(`https://api.xmcl.app/group?id=${groupId}`)
    this.source.onmessage = (ev) => {
      const payload = JSON.parse(ev.data) as RelayPeerMessage
      if (payload.type === 'HELLO') {
        onHello(payload.id)
      } else {
        if (payload.receiver !== id) {
          return
        }
        if (payload.type === 'CONNECT') {
          onConnect(payload.sender)
        } else if (payload.type === 'DESCRIPTOR') {
          onDescriptor(payload.sender, payload.sdp, payload.sdpType)
        } else if (payload.type === 'CANDIDATE') {
          onCandidate(payload.sender, payload.candidate, payload.mid)
        }
      }
    }
    this.source.onopen = (ev) => {
      this.send({
        type: 'HELLO',
        id,
      })
    }
  }

  connect(id: string) {
    return this.send({
      type: 'CONNECT',
      sender: this.id,
      receiver: id,
    })
  }

  sendCandidate(id: string, candidate: string, mid: string) {
    return this.send({
      type: 'CANDIDATE',
      receiver: id,
      candidate,
      mid,
      sender: this.id,
    })
  }

  sendLocalDescription(id: string, sdp: string, type: DescriptionType) {
    return this.send({
      type: 'DESCRIPTOR',
      receiver: id,
      sdp,
      sdpType: type,
      sender: this.id,
    })
  }

  async send(message: RelayPeerMessage) {
    await request('https://api.xmcl.app', {
      method: 'PUT',
      body: JSON.stringify(message),
    })
  }

  quit() {
    this.source.close()
  }
}
