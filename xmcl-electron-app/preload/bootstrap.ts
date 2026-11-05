import { contextBridge, ipcRenderer } from 'electron'
import type { Bootstrap } from '@xmcl/runtime-api'

const bootstrap: Bootstrap = {
  xmclImport: {
    preview: (source) => ipcRenderer.invoke('xmcl-import-preview', source),
    status: () => ipcRenderer.invoke('xmcl-import-status'),
    copy: () => ipcRenderer.invoke('xmcl-import-copy'),
    cancel: () => ipcRenderer.invoke('xmcl-import-cancel'),
    activate: () => ipcRenderer.invoke('xmcl-import-activate'),
    rollback: () => ipcRenderer.invoke('xmcl-import-rollback'),
    restart: () => ipcRenderer.invoke('xmcl-import-restart'),
  },
  preset() {
    return ipcRenderer.invoke('preset')
  },
  bootstrap(...preset: any[]) {
    return ipcRenderer.invoke('bootstrap', ...preset)
  },
}

contextBridge.exposeInMainWorld('bootstrap', bootstrap)
