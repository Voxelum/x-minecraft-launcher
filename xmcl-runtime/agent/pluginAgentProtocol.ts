import { AGENT_PROXY_ENDPOINT } from '@xmcl/runtime-api'
import type { LauncherAppPlugin } from '~/app'
import { kXmclSessionAuthorization, XmclAccountService } from '~/xmclAccount'
import { AgentService, kResolvedAgentProvider } from './AgentService'
import {
  createAgentProtocolHandler,
  type AgentXmclAuthorizationRequest,
} from './providerProtocol'

export const pluginAgentProtocol: LauncherAppPlugin = (app) => {
  app.protocol.registerHandler(new URL(AGENT_PROXY_ENDPOINT).protocol.slice(0, -1), createAgentProtocolHandler(
    async () => {
      const service = await app.registry.getOrCreate(AgentService)
      return service[kResolvedAgentProvider]()
    },
    async (request?: AgentXmclAuthorizationRequest) => {
      const service = await app.registry.getOrCreate(XmclAccountService)
      return service[kXmclSessionAuthorization](request)
    },
  ))
}
