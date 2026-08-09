import {
  MultiplayerIceServerCredential,
  MultiplayerRoomAdmission,
  PeerServiceKey,
  PeerState,
  UserServiceKey,
} from '@xmcl/runtime-api'
import { createMultiplayer, listen } from '@xmcl/wrtc-multiplayer'
import { contextBridge, ipcRenderer } from 'electron/renderer'
import './controller'
import { serviceChannels } from './service'

interface MultiplayerInitPayload {
  appDataPath: string
  resourcePath: string
  sessionId: string
  signalingBaseUrl: string
}

let inited = false
const initPayload = ipcRenderer.invoke('multiplayer-init') as Promise<MultiplayerInitPayload>
initPayload.then((payload) => {
  init(payload.appDataPath, payload.resourcePath, payload.sessionId)
  emitter.emit('ready')
  inited = true
})

ipcRenderer.on('peer-instance-shared', (_, options) => {
  shareInstance(options)
})

let stateReady = false
const peerServ = serviceChannels.open(PeerServiceKey)
peerServ
  .call('getPeerState')
  .then((state) => state)
  .then((state) => {
    for (const key of Object.getOwnPropertyNames(PeerState.prototype)) {
      if (key === 'constructor' || (state as any)[key]) continue
      if (typeof (PeerState.prototype as any)[key] === 'function') {
        ;(state as any)[key] = (...args: any[]) => (state as any).commit(key, ...args)
      }
    }
    state.subscribeAll((mutation, payload) => {
      ;((PeerState.prototype as any)[mutation] as Function | undefined)?.call(state, payload)
    })
    setState(state)
    stateReady = true
  })

async function request(path: string, init: RequestInit) {
  const { signalingBaseUrl } = await initPayload
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(new URL(path, signalingBaseUrl), {
    ...init,
    headers,
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    let message = text
    try {
      message = (JSON.parse(text) as { message?: string }).message || text
    } catch {
      // Keep the response text as the error message.
    }
    throw new Error(message || `multiplayer_request_failed:${response.status}`)
  }
  return { response, signalingBaseUrl }
}

function parseAdmission(input: unknown, signalingBaseUrl: string): MultiplayerRoomAdmission {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('multiplayer_room_invalid_admission')
  }
  const admission = input as Record<string, unknown>
  if (
    typeof admission.roomId !== 'string' ||
    !admission.roomId ||
    typeof admission.socketUrl !== 'string' ||
    !admission.socketUrl ||
    typeof admission.ticket !== 'string' ||
    !admission.ticket ||
    typeof admission.peerId !== 'string' ||
    !admission.peerId ||
    typeof admission.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(admission.expiresAt)) ||
    (admission.role !== 'master' && admission.role !== 'member') ||
    !Number.isSafeInteger(admission.maxPeers) ||
    Number(admission.maxPeers) < 2 ||
    Number(admission.maxPeers) > 16
  ) {
    throw new Error('multiplayer_room_invalid_admission')
  }
  let socketUrl: URL
  try {
    socketUrl = new URL(admission.socketUrl, signalingBaseUrl)
  } catch {
    throw new Error('multiplayer_room_invalid_socket_url')
  }
  if (socketUrl.protocol === 'https:') socketUrl.protocol = 'wss:'
  if (socketUrl.protocol === 'http:') socketUrl.protocol = 'ws:'
  if (socketUrl.protocol !== 'ws:' && socketUrl.protocol !== 'wss:') {
    throw new Error(`multiplayer_room_invalid_socket_protocol:${socketUrl.protocol}`)
  }
  if (socketUrl.username || socketUrl.password || socketUrl.hash) {
    throw new Error('multiplayer_room_invalid_socket_url')
  }
  return {
    roomId: admission.roomId,
    socketUrl: socketUrl.toString(),
    ticket: admission.ticket,
    peerId: admission.peerId,
    expiresAt: admission.expiresAt,
    role: admission.role,
    maxPeers: Number(admission.maxPeers),
  }
}

const { init, emitter, shareInstance, setState, host, updateIceServers, ...peer } =
  createMultiplayer({
    async createRoom(displayName, maxPeers) {
      const { response, signalingBaseUrl } = await request('/v1/multiplayer/rooms', {
        method: 'POST',
        body: JSON.stringify({ displayName, maxPeers }),
      })
      return parseAdmission(await response.json(), signalingBaseUrl)
    },
    async joinRoom(roomId, displayName, createIfMissing) {
      const { response, signalingBaseUrl } = await request(
        `/v1/multiplayer/rooms/${encodeURIComponent(roomId)}/join`,
        {
          method: 'POST',
          body: JSON.stringify({ displayName, createIfMissing }),
        },
      )
      return parseAdmission(await response.json(), signalingBaseUrl)
    },
    async closeRoom(roomId) {
      await request(`/v1/multiplayer/rooms/${encodeURIComponent(roomId)}`, {
        method: 'DELETE',
      })
    },
    async getIceServerCredential() {
      const { response } = await request('/v1/rtc/official', { method: 'POST' })
      return (await response.json()) as MultiplayerIceServerCredential
    },
  })

let refreshTimer: ReturnType<typeof setTimeout> | undefined
const scheduleIceServerRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    refreshTimer = undefined
    void updateIceServers()
  }, 250)
}

initPayload.then(() => updateIceServers()).catch(console.error)
const userServ = serviceChannels.open(UserServiceKey)
userServ
  .call('getUserState')
  .then((state) => state)
  .then((state) => {
    state.subscribeAll((mutation) => {
      if (
        mutation === 'userData' ||
        mutation === 'userProfile' ||
        mutation === 'userProfileRemove' ||
        mutation === 'gameProfileUpdate'
      ) {
        scheduleIceServerRefresh()
      }
    })
  })
  .catch(console.error)

listen(host, 25566, (p) => p + 2).then((s) => {
  ipcRenderer.invoke('multiplayer-port', s)
})

const multiplayer = {
  ...peer,
  isReady: () => inited && stateReady,
  on: (eventName: string | symbol, listener: (...args: any[]) => void) =>
    emitter.on(eventName, listener),
  once: (eventName: string | symbol, listener: (...args: any[]) => void) =>
    emitter.once(eventName, listener),
  off: (eventName: string | symbol, listener: (...args: any[]) => void) =>
    emitter.off(eventName, listener),
  addListener: (eventName: string | symbol, listener: (...args: any[]) => void) =>
    emitter.addListener(eventName, listener),
  removeListener: (eventName: string | symbol, listener: (...args: any[]) => void) =>
    emitter.removeListener(eventName, listener),
}

contextBridge.exposeInMainWorld('multiplayer', multiplayer)
