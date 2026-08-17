/**
 * Bridge injected into the multiplayer window.
 *
 * Electron ran the peer mesh itself here, in the preload of that window, on
 * `node-datachannel`. A Tauri webview has no Node, and WebKitGTK has no
 * `RTCPeerConnection` on Linux, so the peer lives in the sidecar
 * (`sidecar/multiplayer/MultiplayerHost.ts`) and this module only rebuilds the
 * `multiplayer` global that `xmcl-keystone-ui` consumes, forwarding every call
 * over the bridge and re-emitting the events the host broadcasts.
 */

import { contextBridge, ipcRenderer } from 'electron'
import { EventEmitter } from 'events'
import './index'

const emitter = new EventEmitter()
// The UI adds one listener per composable instance, well past the default ten.
emitter.setMaxListeners(0)

let ready = false
const call = (method: string, ...args: unknown[]) =>
  ipcRenderer.invoke('multiplayer-call', method, args)

// The peer reads these from `localStorage`, which it had in Electron because it
// ran in this context. `Multiplayer.vue` writes them from the launcher window,
// same origin, so they are visible here too.
const SETTING_KEYS = ['peerKernel', 'peerAllowTurn', 'peerPreferredTurn']
const pushSettings = () =>
  ipcRenderer.invoke(
    'multiplayer-settings',
    Object.fromEntries(SETTING_KEYS.map((key) => [key, localStorage.getItem(key)])),
  )

ipcRenderer.on('multiplayer-event', (_: unknown, event: string, args: unknown[]) => {
  if (event === 'ready') ready = true
  emitter.emit(event, ...args)
})

// The host starts with the window, so its `ready` broadcast can land before
// this window's bridge socket is up. Ask until it answers, then stop.
let attempts = 0
const readyPoll = setInterval(() => {
  if (ready || ++attempts > 40) {
    clearInterval(readyPoll)
    return
  }
  void ipcRenderer.invoke('multiplayer-ready').then((value: boolean) => {
    if (!value || ready) return
    ready = true
    emitter.emit('ready')
  })
}, 500)

const multiplayer = {
  isReady: () => ready,
  refreshNat: () => call('refreshNat'),
  setUserInfo: (info: unknown) => void call('setUserInfo', info),
  // Every call re-syncs the preferences first: they decide the kernel and the
  // TURN server the new connection picks.
  initiate: () => pushSettings().then(() => call('initiate')),
  setRemoteDescription: (options: unknown) => call('setRemoteDescription', options),
  drop: (id: string) => call('drop', id),
  createGroup: () => pushSettings().then(() => call('createGroup')),
  joinGroup: (groupId: string) => pushSettings().then(() => call('joinGroup', groupId)),
  transferGroupMaster: (peerId: string) => call('transferGroupMaster', peerId),
  leaveGroup: () => call('leaveGroup'),
  shareInstance: (options: unknown) => call('shareInstance', options),
  on: (event: string | symbol, listener: (...args: any[]) => void) => emitter.on(event, listener),
  once: (event: string | symbol, listener: (...args: any[]) => void) =>
    emitter.once(event, listener),
  off: (event: string | symbol, listener: (...args: any[]) => void) => emitter.off(event, listener),
  addListener: (event: string | symbol, listener: (...args: any[]) => void) =>
    emitter.addListener(event, listener),
  removeListener: (event: string | symbol, listener: (...args: any[]) => void) =>
    emitter.removeListener(event, listener),
}

contextBridge.exposeInMainWorld('multiplayer', multiplayer)

// After the global: the page fails to mount without `multiplayer`, so nothing
// that can throw runs before it is exposed.
void pushSettings()
window.addEventListener('storage', (event) => {
  if (event.key === null || SETTING_KEYS.includes(event.key)) void pushSettings()
})
