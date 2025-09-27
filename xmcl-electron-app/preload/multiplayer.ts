import { AUTHORITY_MICROSOFT, Multiplayer, PeerServiceKey, UserServiceKey } from '@xmcl/runtime-api'
import { createMultiplayer } from '@xmcl/runtime/peer/multiplayer_core'
import { listen } from '@xmcl/runtime/util/server'
import { contextBridge, ipcRenderer } from 'electron/renderer'
import './controller'
import { serviceChannels } from './service'

let inited = false
ipcRenderer.invoke('multiplayer-init').then((payload: { appDataPath: string; resourcePath: string; sessionId: string }) => {
  init(payload.appDataPath, payload.resourcePath, payload.sessionId)
  emitter.emit('ready')
  inited = true
})

ipcRenderer.on('peer-instance-shared', (_, options) => {
  sharing.shareInstance(options)
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
    iceServers.update()
    updated = true
  }
  if (!updated) {
    state.subscribe('userProfile', (p) => {
      if (p.authority === AUTHORITY_MICROSOFT) {
        iceServers.update()
        updated = true
      }
    })
  }
})

const { init, emitter, sharing, setState, host, iceServers, nat, group, userInfo, initiate, setRemoteDescription, drop } = createMultiplayer()

listen(host, 25566, (p) => p + 2).then((s) => {
  ipcRenderer.invoke('multiplayer-port', s)
})

const multiplayer: Multiplayer = {
  refreshNat: nat.refreshNat,
  setUserInfo: userInfo.setUserInfo,
  initiate,
  setRemoteDescription,
  drop,
  joinGroup: group.joinGroup,
  leaveGroup: group.leaveGroup,
  isReady: () => inited && stateReady,
  on: (eventName: string | symbol, listener: (...args: any[]) => void) => emitter.on(eventName, listener) as any,
  once: (eventName: string | symbol, listener: (...args: any[]) => void) => emitter.once(eventName, listener) as any,
  removeListener: (eventName: string | symbol, listener: (...args: any[]) => void) => emitter.removeListener(eventName, listener) as any,
}

contextBridge.exposeInMainWorld('multiplayer', multiplayer)
