import './controller'
import { serviceChannels } from './service'
import { AUTHORITY_MICROSOFT, PeerServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import { createMultiplayer } from '@xmcl/runtime/peer/multiplayerImpl'
import { listen } from '@xmcl/runtime/util/server'
import { contextBridge, ipcRenderer } from 'electron/renderer'

let inited = false
ipcRenderer.invoke('multiplayer-init').then((payload: { appDataPath: string; resourcePath: string; sessionId: string }) => {
  init(payload.appDataPath, payload.resourcePath, payload.sessionId)
  emitter.emit('ready')
  inited = true
})

ipcRenderer.on('peer-instance-shared', (_, options) => {
  shareInstance(options)
})

let stateReady = false
const peerServ = serviceChannels.open(PeerServiceKey)
peerServ.call('getPeerState').then((state) => state).then(state => {
  setState(state)
  stateReady = true
})

const userServ = serviceChannels.open(UserServiceKey)
userServ.call('getUserState').then((state) => state).then(state => {
  let updated = false
  if (Object.values(state.users).some(u => u.authority === AUTHORITY_MICROSOFT)) {
    updateIceServers()
    updated = true
  }
  if (!updated) {
    state.subscribe('userProfile', (p) => {
      if (p.authority === AUTHORITY_MICROSOFT) {
        updateIceServers()
        updated = true
      }
    })
  }
})

const { init, emitter, shareInstance, setState, host, updateIceServers, ...peer } = createMultiplayer()

listen(host, 25566, (p) => p + 2).then((s) => {
  ipcRenderer.invoke('multiplayer-port', s)
})

const multiplayer = {
  ...peer,
  refreshNat: peer.refreshNat,
  isNatSupported: peer.isNatSupported,
  isReady: () => inited && stateReady,
  on: (eventName: string | symbol, listener: (...args: any[]) => void) => emitter.on(eventName, listener),
  once: (eventName: string | symbol, listener: (...args: any[]) => void) => emitter.once(eventName, listener),
  off: (eventName: string | symbol, listener: (...args: any[]) => void) => emitter.off(eventName, listener),
  addListener: (eventName: string | symbol, listener: (...args: any[]) => void) => emitter.addListener(eventName, listener),
  removeListener: (eventName: string | symbol, listener: (...args: any[]) => void) => emitter.removeListener(eventName, listener),
}

contextBridge.exposeInMainWorld('multiplayer', multiplayer)
