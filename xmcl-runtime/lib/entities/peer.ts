// import EventSource from 'eventsource'
import { EventSource } from '../util/EventSource'
import { DescriptionType } from 'node-datachannel'
import { Client, request } from 'undici'
import { setTimeout } from 'timers/promises'
import { createPromiseSignal, PromiseSignal } from '../util/promiseSignal'

export interface TransferDescription {
  session: string
  id: string
  sdp: string
}

type RelayPeerMessage = {
  type: 'HELLO'
  id: string
} | {
  type: 'DESCRIPTOR-ECHO'
  receiver: string
  sender: string
  id: number
} | {
  type: 'DESCRIPTOR'
  receiver: string
  sender: string
  sdp: string
  candidates: Array<{ candidate: string; mid: string }>
  sdpType: DescriptionType
  id: number
}

export class PeerGroup {
  static async join(groupId: string, id: string,
    onHello: (sender: string) => void,
    onDescriptor: (sender: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>) => void,
  ) {
    const source = new EventSource(`https://api.xmcl.app/group?id=${groupId}`, { })

    source.on('error', (e) => {
      // NOOP
    })
    const group = new PeerGroup(source, groupId, id)
    source.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data) as RelayPeerMessage
        if (payload.type === 'HELLO') {
          if (payload.id !== id) {
            onHello(payload.id)
          }
        } else {
          if (payload.receiver !== id) {
            return
          }
          if (payload.type === 'DESCRIPTOR') {
            onDescriptor(payload.sender, payload.sdp, payload.sdpType, payload.candidates)
            group.send({
              type: 'DESCRIPTOR-ECHO',
              receiver: payload.sender,
              sender: group.id,
              id: payload.id,
            })
          } else if (payload.type === 'DESCRIPTOR-ECHO') {
            const signal = group.signals[payload.id]
            if (signal) {
              signal.resolve()
              delete group.signals[payload.id]
            }
          }
        }
      } catch (e) {
        debugger
      }
    }

    source.onopen = () => {
      group.send({
        type: 'HELLO',
        id,
      })
    }

    await new Promise<void>((resolve, reject) => {
      const onError = (e: any) => {
        reject(e)
        source.removeEventListener('open', onResolve)
        source.removeEventListener('error', onError)
      }
      const onResolve = () => {
        resolve()
        source.removeEventListener('open', onResolve)
        source.removeEventListener('error', onError)
      }
      source.addEventListener('open', onResolve)
      source.addEventListener('error', onError)
    })

    return group
  }

  private messageId = 0

  readonly signals: Record<number, PromiseSignal<void>> = {}

  constructor(private source: EventSource, readonly groupId: string, readonly id: string) {
  }

  wait(messageId: number): Promise<void> {
    this.signals[messageId] = createPromiseSignal()
    return this.signals[messageId].promise
  }

  async sendLocalDescription(id: string, sdp: string, type: DescriptionType, candidates: Array<{ candidate: string; mid: string }>) {
    const messageId = this.messageId++
    while (true) {
      await this.send({
        type: 'DESCRIPTOR',
        receiver: id,
        sdp,
        sdpType: type,
        sender: this.id,
        candidates,
        id: messageId,
      })
      const responsed = await Promise.race([
        this.wait(messageId).then(() => true, () => false),
        setTimeout(4_000).then(() => false), // wait 4 seconds for response
      ])
      if (responsed) {
        return
      }
    }
  }

  async send(message: RelayPeerMessage) {
    await request(`https://api.xmcl.app/group?id=${this.groupId}`, {
      method: 'PUT',
      body: JSON.stringify(message),
    })
  }

  quit() {
    this.source.close()
  }
}
