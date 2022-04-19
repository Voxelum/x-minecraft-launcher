import { ipcRenderer } from 'electron'
import { MessageIdentityEntry } from './peer/messages/identity'
import { MessageLanEntry } from './peer/messages/lan'
import { MessageMemberJoinAcceptEntry, MessageMemberJoinEntry, MessageMemberJoinInitiateEntry } from './peer/messages/memberJoin'
import { PeerHost } from './peer/PeerHost'

const host = new PeerHost([
  MessageLanEntry,
  MessageIdentityEntry,
  MessageMemberJoinEntry,
  MessageMemberJoinInitiateEntry,
  MessageMemberJoinAcceptEntry,
])

function handle<T>(method: string, func: (...args: any[]) => void) {
  ipcRenderer.on(method, async (events, id, ...args) => {
    try {
      const result = await func(...args)
      ipcRenderer.send(method, {
        id,
        result,
      })
    } catch (error) {
      ipcRenderer.send(method, {
        id,
        error,
      })
    }
  })
}

export interface TransferDescription {
  session: string
  id: string
  sdp: string
}

handle('create', (id) => {
  console.log(`create new connection ${id}`)
  host.create(id)
})

handle('initiate', async (id: string) => {
  console.log(`initiate ${id}`)
  const conn = host.connections[id]
  if (!conn) {
    throw new Error(`No connection named ${id}`)
  }
  const offer = await conn.initiate()
  return { type: offer?.type, sdp: offer?.sdp }
})

handle('answer', async ({ session, id, sdp }: TransferDescription) => {
  console.log(`answer ${session}`)
  const conn = host.connections[session]
  conn.remoteId = id
  await conn.answer({ type: 'answer', sdp })
})

handle('offer', async ({ session, id, sdp }: TransferDescription) => {
  const conn = host.create(session, id)
  console.log(`offer ${session}`)
  await conn.offer({ type: 'offer', sdp })
  return session
})

handle('drop', (id: string) => {
  host.drop(id)
})
