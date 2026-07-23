import type { AgentBridgeRegistration, AgentRunEvent, AgentUiAction, AgentUiRequest, AgentUiResponse } from '@xmcl/runtime-api'
import { randomUUID } from 'crypto'
import type { Client, LauncherApp, LauncherAppPlugin } from '~/app'

interface Bridge {
  client: Client
  registration: AgentBridgeRegistration
}

interface PendingCall {
  bridgeId: string
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
  cleanup: () => void
}

export class AgentBridge {
  private bridges = new Map<string, Bridge>()
  private pending = new Map<string, PendingCall>()
  private clientBridges = new Map<Client, { ids: Set<string>; onDestroyed: () => void }>()

  register(client: Client, registration: AgentBridgeRegistration) {
    this.unregister(registration.bridgeId)
    let linked = this.clientBridges.get(client)
    if (!linked) {
      const ids = new Set<string>()
      const onDestroyed = () => {
        for (const id of ids) this.unregister(id)
      }
      linked = { ids, onDestroyed }
      this.clientBridges.set(client, linked)
      client.on('destroyed', onDestroyed)
    }
    linked.ids.add(registration.bridgeId)
    this.bridges.set(registration.bridgeId, { client, registration })
  }

  unregister(bridgeId: string) {
    const bridge = this.bridges.get(bridgeId)
    if (bridge) {
      const linked = this.clientBridges.get(bridge.client)
      linked?.ids.delete(bridgeId)
      if (linked && linked.ids.size === 0) {
        bridge.client.removeListener('destroyed', linked.onDestroyed)
        this.clientBridges.delete(bridge.client)
      }
    }
    this.bridges.delete(bridgeId)
    for (const [callId, call] of this.pending) {
      if (call.bridgeId !== bridgeId) continue
      clearTimeout(call.timer)
      call.cleanup()
      call.reject(new Error('Agent renderer bridge disconnected'))
      this.pending.delete(callId)
    }
  }

  dispose() {
    for (const id of this.bridges.keys()) this.unregister(id)
  }

  getRegistration(bridgeId: string) {
    return this.bridges.get(bridgeId)?.registration
  }

  sendRunEvent(bridgeId: string, event: AgentRunEvent) {
    const bridge = this.bridges.get(bridgeId)
    if (!bridge || bridge.client.isDestroyed()) return false
    bridge.client.send('agent-run-event', event)
    return true
  }

  executeUi(bridgeId: string, runId: string, input: AgentUiAction, timeoutMs: number, signal?: AbortSignal) {
    const bridge = this.bridges.get(bridgeId)
    if (!bridge || bridge.client.isDestroyed()) return Promise.reject(new Error('Agent renderer bridge is unavailable'))
    const callId = randomUUID()
    return new Promise<unknown>((resolve, reject) => {
      const cleanup = () => signal?.removeEventListener('abort', onAbort)
      const finish = (error?: Error, result?: unknown) => {
        const pending = this.pending.get(callId)
        if (!pending) return
        clearTimeout(pending.timer)
        pending.cleanup()
        this.pending.delete(callId)
        if (error) reject(error)
        else resolve(result)
      }
      const onAbort = () => {
        bridge.client.send('agent-tool-cancel', { bridgeId, runId, callId })
        finish(new Error('Agent tool call aborted'))
      }
      const timer = setTimeout(() => finish(new Error(`Agent UI action timed out: ${input.action}`)), timeoutMs)
      this.pending.set(callId, { bridgeId, resolve, reject, timer, cleanup })
      signal?.addEventListener('abort', onAbort, { once: true })
      const request: AgentUiRequest = { bridgeId, runId, callId, input, timeoutMs }
      bridge.client.send('agent-ui-request', request)
    })
  }

  resolve(response: AgentUiResponse) {
    const pending = this.pending.get(response.callId)
    if (!pending || pending.bridgeId !== response.bridgeId) return
    clearTimeout(pending.timer)
    pending.cleanup()
    this.pending.delete(response.callId)
    if (response.error) pending.reject(new Error(response.error))
    else pending.resolve(response.result)
  }
}

export const pluginAgentBridge: LauncherAppPlugin = (app: LauncherApp) => {
  const bridge = new AgentBridge()
  app.registry.register(AgentBridge, bridge)
  app.controller.handle('agent-bridge-register', ({ sender }, registration: AgentBridgeRegistration) => {
    bridge.register(sender, registration)
  })
  app.controller.handle('agent-bridge-unregister', (_, bridgeId: string) => {
    bridge.unregister(bridgeId)
  })
  app.controller.handle('agent-bridge-resolve', (_, response: AgentUiResponse) => {
    bridge.resolve(response)
  })
  app.registryDisposer(() => bridge.dispose())
}
