import { InstanceManifestSchema } from '@xmcl/runtime-api'
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
  const conn = host.sessions[id]
  if (!conn) {
    throw new Error(`No connection named ${id}`)
  }
  const offer = await conn.initiate()
  return { type: offer?.type, sdp: offer?.sdp }
})

handle('answer', async ({ session, id, sdp }: TransferDescription) => {
  console.log(`answer ${session}`)
  const conn = host.sessions[session]
  conn.remoteId = id
  await conn.answer({ type: 'answer', sdp })
})

handle('offer', async ({ session, id, sdp }: TransferDescription) => {
  const conn = host.create(session, id)
  console.log(`offer ${session}`)
  await conn.offer({ type: 'offer', sdp })
  return session
})

handle('download', async ({ url, destination, sha1 }) => {
  const peerUrl = new URL(url)
  if (peerUrl.protocol !== 'peer') {
    throw new Error(`Bad url: ${url}`)
  }
  const filePath = peerUrl.pathname
  const conn = host.getByRemoteId(peerUrl.host)
  if (conn) {
    await conn.download(filePath, destination, sha1)
    return true
  }
  return false
})

handle('download-abort', async ({ url }) => {
  const peerUrl = new URL(url)
  if (peerUrl.protocol !== 'peer') {
    throw new Error(`Bad url: ${url}`)
  }
  const filePath = peerUrl.pathname
  ipcRenderer.emit('download-abort-internal', undefined, peerUrl.host, filePath)
})

handle('share', async (manifest?: InstanceManifestSchema) => {
  if (manifest) {
    for (const f of manifest.files) {
      if (f.downloads) {
        f.downloads.push(`peer://${host.id}/${f.path}`)
      } else {
        f.downloads = [`peer://${host.id}/${f.path}`]
      }
    }
  }
  host.setShareInstance(manifest)
})

handle('drop', (id: string) => {
  host.drop(id)
})
