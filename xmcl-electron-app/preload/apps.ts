import { AppsHost } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'

function createAppsHost(): AppsHost {
  const appsHost: AppsHost = {
    getInstalledApps() {
      return ipcRenderer.invoke('get-installed-apps')
    },
    installApp(url) {
      return ipcRenderer.invoke('install-app', url)
    },
    uninstallApp(url) {
      return ipcRenderer.invoke('uninstall-app', url)
    },
    getAppInfo(url) {
      return ipcRenderer.invoke('get-app-info', url)
    },
    getDefaultApp() {
      return ipcRenderer.invoke('get-default-app')
    },
    bootAppByUrl(url) {
      return ipcRenderer.invoke('launch-app', url)
    },
    createShortcut(url) {
      return ipcRenderer.invoke('create-app-shortcut', url)
    },
  }

  return appsHost
}

contextBridge.exposeInMainWorld('appsHost', createAppsHost())
