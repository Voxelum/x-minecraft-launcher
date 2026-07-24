import type { AgentBridgeRegistration, AgentProviderStreamEvent, AgentProviderStreamRequest } from '@xmcl/runtime-api'
import type { Client } from '~/app'

interface Bridge {
  client: Client
  registration: AgentBridgeRegistration
}

export class AgentBridge {
  private bridges = new Map<string, Bridge>()
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
  }

  dispose() {
    for (const id of this.bridges.keys()) this.unregister(id)
  }

  owns(client: Client, bridgeId: string) {
    return this.bridges.get(bridgeId)?.client === client
  }

  has(bridgeId: string) {
    const bridge = this.bridges.get(bridgeId)
    return !!bridge && !bridge.client.isDestroyed()
  }

  sendProviderEvent(bridgeId: string, event: AgentProviderStreamEvent) {
    const bridge = this.bridges.get(bridgeId)
    if (!bridge || bridge.client.isDestroyed()) return false
    bridge.client.send('agent-provider-event', event)
    return true
  }
}
