import { contextBridge, ipcRenderer } from 'electron'
import { SetupAPI } from '@xmcl/runtime-api/setup'
import './controller'

const api: SetupAPI = {
  preset() {
    return ipcRenderer.invoke('preset')
  },
  setup(path, i, l) {
    return ipcRenderer.invoke('setup', path, i, l)
  },
}

contextBridge.exposeInMainWorld('api', api)
