import type { LauncherAppPlugin } from '~/app'
import { kXmclSessionAuthorization, XmclAccountService } from '~/xmclAccount'
import { AgentService, kResolvedAgentProvider } from './AgentService'
import { createAgentProtocolHandler } from './providerProtocol'

export const pluginAgentProtocol: LauncherAppPlugin = (app) => {
  app.protocol.registerHandler('https', createAgentProtocolHandler(
    async () => {
      const service = await app.registry.getOrCreate(AgentService)
      return service[kResolvedAgentProvider]()
    },
    async () => {
      const service = await app.registry.getOrCreate(XmclAccountService)
      return service[kXmclSessionAuthorization]()
    },
  ))
}