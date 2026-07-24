import type { AgentBridgeRegistration, AgentProviderStreamRequest } from '@xmcl/runtime-api'
import type { LauncherAppPlugin } from '~/app'
import { AgentBridge } from './AgentBridge'
import { AgentService } from './AgentService'

export const pluginAgentBridge: LauncherAppPlugin = (app) => {
  const bridge = new AgentBridge()
  app.registry.register(AgentBridge, bridge)
  app.controller.handle('agent-bridge-register', ({ sender }, registration: AgentBridgeRegistration) => {
    bridge.register(sender, registration)
  })
  app.controller.handle('agent-bridge-unregister', async (_, bridgeId: string) => {
    const service = await app.registry.getOrCreate(AgentService)
    service.cancelProviderBridge(bridgeId)
    bridge.unregister(bridgeId)
  })
  app.controller.handle('agent-provider-stream', async ({ sender }, request: AgentProviderStreamRequest) => {
    if (!bridge.owns(sender, request.bridgeId)) throw new Error('Agent provider bridge is not registered')
    const service = await app.registry.getOrCreate(AgentService)
    await service.startProviderStream(request, bridge)
  })
  app.controller.handle('agent-provider-cancel', async ({ sender }, bridgeId: string, requestId: string) => {
    if (!bridge.owns(sender, bridgeId)) return
    const service = await app.registry.getOrCreate(AgentService)
    service.cancelProviderStream(bridgeId, requestId)
  })
  app.registryDisposer(() => bridge.dispose())
}
