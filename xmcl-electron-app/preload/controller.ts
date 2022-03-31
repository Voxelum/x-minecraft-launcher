import { WindowController } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
}

function createController(): WindowController {
  function show() {
    return ipcRenderer.invoke('control', Operation.Show)
  }
  function hide() {
    return ipcRenderer.invoke('control', Operation.Hide)
  }
  function minimize() {
    return ipcRenderer.invoke('control', Operation.Minimize)
  }
  function maximize() {
    return ipcRenderer.invoke('control', Operation.Maximize)
  }

  return {
    minimize,
    maximize,
    show,
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
