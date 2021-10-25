import { dialog, ipcRenderer } from 'electron'
import { ControllerChannel } from '/@shared/controller'

export enum Operation {
  Minimize = 0,
  Maximize = 1,
  Hide = 2,
  Show = 3,
}

export function createController(): ControllerChannel {
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
  }
}
