import { contextBridge, ipcRenderer } from 'electron'
import { SetupAPI } from '@xmcl/runtime-api/setup'
import './controller'

const api: SetupAPI = {
  preset() {
    return ipcRenderer.invoke('preset')
  },
  setup(path) {
    return ipcRenderer.invoke('setup', path)
  },
}

contextBridge.exposeInMainWorld('api', api)
