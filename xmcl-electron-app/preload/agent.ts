import type { AgentBridgeClient, AgentBridgeRegistration, AgentRunEvent, AgentUiRequest, AgentUiResponse } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'

function createAgentBridge(): AgentBridgeClient {
  const emitter = new EventEmitter()
  ipcRenderer.on('agent-run-event', (_, event: AgentRunEvent) => emitter.emit('run-event', event))
  ipcRenderer.on('agent-ui-request', (_, request: AgentUiRequest) => emitter.emit('ui-request', request))
  ipcRenderer.on('agent-tool-cancel', (_, request) => emitter.emit('tool-cancel', request))

  const listen = (event: string, listener: (...args: any[]) => void) => {
    emitter.on(event, listener)
    return () => emitter.removeListener(event, listener)
  }

  return {
    register: (registration: AgentBridgeRegistration) => ipcRenderer.invoke('agent-bridge-register', registration),
    unregister: (bridgeId: string) => ipcRenderer.invoke('agent-bridge-unregister', bridgeId),
    resolve: (response: AgentUiResponse) => ipcRenderer.invoke('agent-bridge-resolve', response),
    onRunEvent: listener => listen('run-event', listener),
    onUiRequest: listener => listen('ui-request', listener),
    onToolCancel: listener => listen('tool-cancel', listener),
  }
}

contextBridge.exposeInMainWorld('agentBridge', createAgentBridge())
