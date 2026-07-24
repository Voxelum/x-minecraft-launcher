import type { AgentBridgeClient, AgentBridgeRegistration, AgentProviderStreamEvent, AgentProviderStreamRequest } from '@xmcl/runtime-api'
import { contextBridge, ipcRenderer } from 'electron'
import EventEmitter from 'events'

function createAgentBridge(): AgentBridgeClient {
  const emitter = new EventEmitter()
  ipcRenderer.on('agent-provider-event', (_, event: AgentProviderStreamEvent) => emitter.emit('provider-event', event))

  const listen = (event: string, listener: (...args: any[]) => void) => {
    emitter.on(event, listener)
    return () => emitter.removeListener(event, listener)
  }

  return {
    register: (registration: AgentBridgeRegistration) => ipcRenderer.invoke('agent-bridge-register', registration),
    unregister: (bridgeId: string) => ipcRenderer.invoke('agent-bridge-unregister', bridgeId),
    stream: (request: AgentProviderStreamRequest) => ipcRenderer.invoke('agent-provider-stream', request),
    cancel: (bridgeId: string, requestId: string) => ipcRenderer.invoke('agent-provider-cancel', bridgeId, requestId),
    onProviderEvent: listener => listen('provider-event', listener),
  }
}

contextBridge.exposeInMainWorld('agentBridge', createAgentBridge())
