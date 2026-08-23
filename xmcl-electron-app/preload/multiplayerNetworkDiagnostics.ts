import type { NetworkDiagnostics } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron/renderer'
import { multiplayerNetworkDiagnosticsChannels } from '../multiplayerNetworkDiagnostics'
const networkDiagnostics: NetworkDiagnostics = {
  refresh: (iceServers) => ipcRenderer.invoke(
    multiplayerNetworkDiagnosticsChannels.refresh,
    iceServers,
  ),
}

contextBridge.exposeInMainWorld('multiplayerNetworkDiagnostics', networkDiagnostics)
