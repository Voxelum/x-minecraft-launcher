import { AgentServiceKey } from '@xmcl/runtime-api'
import { useI18n } from 'vue-i18n'
import { kInstances } from '../instances'
import { useService } from '../service'
import { kUserContext } from '../user'
import { injection } from '@/util/inject'
import { useLocalAgent, type LocalAgentSession } from './local'
import { useCssAgentToolFactory } from './tools'
import { migrateLegacyCssConversation } from './migration'

export type CssAgentSession = LocalAgentSession

export function useCssAgent(): CssAgentSession {
  const { locale } = useI18n()
  const { userProfile } = injection(kUserContext)
  const service = useService(AgentServiceKey)
  const tools = useCssAgentToolFactory()
  const local = useLocalAgent({
    agentId: 'css',
    getScope: () => 'global',
    getLocale: () => locale.value,
    getUserId: () => userProfile.value?.id || undefined,
    createTools: tools.createCssTools,
    getSessionContext: () => 'Global XMCL custom CSS scope.',
  })
  void migrateLegacyCssConversation(service).then(() => local.load())
  return local
}
