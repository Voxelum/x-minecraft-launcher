import type { RendererTelemetryChannel } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'

const telemetry: RendererTelemetryChannel = {
  trackException(exception) {
    return ipcRenderer.invoke('renderer-telemetry-exception', exception)
  },
  flush() {
    return ipcRenderer.invoke('renderer-telemetry-flush')
  },
  startAction(action) {
    return ipcRenderer.invoke('renderer-telemetry-action-start', action)
  },
  endAction(action) {
    return ipcRenderer.invoke('renderer-telemetry-action-end', action)
  },
}

contextBridge.exposeInMainWorld('rendererTelemetry', telemetry)
