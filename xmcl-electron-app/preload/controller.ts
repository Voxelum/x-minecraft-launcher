import { WindowController } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
  Close = 4,
}

function createController(): WindowController {
  function show() {
    return ipcRenderer.invoke('control', Operation.Show)
  }
  function close() {
    return ipcRenderer.invoke('control', Operation.Close)
  }
  function hide() {
    return ipcRenderer.invoke('control', Operation.Hide)
  }
  function minimize() {
    return ipcRenderer.invoke('control', Operation.Minimize)
  }
  function maximize() {
    ipcRenderer.invoke('control', Operation.Maximize)
  }
  function flashFrame() {
    ipcRenderer.invoke('flash-frame')
  }
  function focus() {
    ipcRenderer.invoke('focus')
  }
  ipcRenderer.on('maximize', (_, v) => {
    emitter.emit('maximize', v)
  })
  ipcRenderer.on('minimize', (_, v) => {
    emitter.emit('minimize', v)
  })
  const emitter = new EventEmitter()

  return {
    on(channel, listener) {
      emitter.on(channel, listener)
      return this
    },
    openMultiplayerWindow: () => ipcRenderer.invoke('open-multiplayer-window'),
    once(channel, listener) {
      emitter.once(channel, listener)
      return this
    },
    removeListener(channel, listener) {
      emitter.removeListener(channel, listener)
      return this
    },
    focus,
    flashFrame,
    minimize,
    maximize,
    show,
    close,
    hide,
    showOpenDialog(...options: any[]) {
      return ipcRenderer.invoke('dialog:showOpenDialog', ...options)
    },
    showSaveDialog(...options: any[]) {
      return ipcRenderer.invoke('dialog:showSaveDialog', ...options)
    },
    findInPage(text, options) {
      return ipcRenderer.invoke('find-in-page', text, options)
    },
    stopFindInPage() {
      return ipcRenderer.invoke('stop-find-in-page')
    },
  }
}

contextBridge.exposeInMainWorld('windowController', createController())
