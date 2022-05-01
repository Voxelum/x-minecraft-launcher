import { RTCSessionDescription } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import { defineMessage, MessageType } from './message'

export const MessageMemberJoin: MessageType<{ id: string }> = 'member-join'
export const MessageMemberJoinInitiate: MessageType<{ from: string; to: string; session: string; offer: RTCSessionDescription }> = 'member-join-offer'
export const MessageMemberJoinAccept: MessageType<{ from: string; to: string; session: string; answer: RTCSessionDescription }> = 'member-join-answer'

export const MessageMemberJoinEntry = defineMessage(MessageMemberJoin, async function ({ id }) {
  if (Object.values(this.host.connections).some(c => c.remoteId === id)) {
    // no duplicated join
    return
  }
  const sessionId = randomUUID()
  const conn = this.host.create(sessionId, id)
  console.log(`initiate ${conn.id}`)
  await conn.initiate()

  console.log('Wait the ice to collect for 2 seconds')
  await new Promise((resolve) => {
    setTimeout(resolve, 2000)
  })
  console.log(`Send MessageMemberJoinInitiate to ${this.id} (${this.remoteId})`)

  this.send(MessageMemberJoinInitiate, { offer: { type: this.connection.localDescription!.type!, sdp: this.connection.localDescription?.sdp }, session: sessionId, to: id, from: this.host.id })
})

export const MessageMemberJoinInitiateEntry = defineMessage(MessageMemberJoinInitiate, async function ({ to, session, from, offer }) {
  if (to === this.host.id) {
    // i'm the target
    console.log(`offer from ${from} to me`)
    const conn = this.host.create(session, from)
    await conn.offer(offer)

    await new Promise((resolve) => {
      setTimeout(resolve, 2000)
    })

    console.log(`Send answer to ${to}`)

    this.send(MessageMemberJoinAccept, { from: to, to: from, session, answer: { type: this.connection.localDescription!.type!, sdp: this.connection.localDescription?.sdp } })
  } else {
    // i'm the man in middle
    console.log(`redirect offer from ${from} to ${to}`)
    const conn = this.host.getByRemoteId(to)
    if (conn) {
      conn.send(MessageMemberJoinInitiate, { to, from, session, offer })
    } else {
      console.error(`Cannot propagate join offer from ${from} to ${to}`)
    }
  }
})

export const MessageMemberJoinAcceptEntry = defineMessage(MessageMemberJoinAccept, function ({ to, from, session, answer }) {
  if (to === this.host.id) {
    // this is the target
    console.log(`Answer from ${from} to ${to}`)
    const conn = this.host.getByRemoteId(from)
    if (conn) {
      conn.answer(answer)
    } else {
      console.error(`Cannot find session ${from}`)
    }
  } else {
    // i'm the man in middle
    console.log(`redirect answer from ${from} to ${to}`)
    const conn = this.host.getByRemoteId(to)
    if (conn) {
      conn.send(MessageMemberJoinAccept, { to, from, session, answer })
    } else {
      console.error(`Cannot propagate join answer from ${from} to ${to}`)
    }
  }
})
