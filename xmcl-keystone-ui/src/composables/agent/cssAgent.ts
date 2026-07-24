import { AgentServiceKey } from '@xmcl/runtime-api'
import { useI18n } from 'vue-i18n'
import { kInstances } from '../instances'
import { useService } from '../service'
import { kUserContext } from '../user'
import { injection } from '@/util/inject'
import { useLocalAgent, type LocalAgentSession } from './local'
import { useAgentToolFactory } from './tools'

export type CssAgentSession = LocalAgentSession

export function useCssAgent(): CssAgentSession {
  const { locale } = useI18n()
  const { userProfile } = injection(kUserContext)
  const service = useService(AgentServiceKey)
  const tools = useAgentToolFactory()
  const local = useLocalAgent({
    agentId: 'css',
    getScope: () => 'global',
    getLocale: () => locale.value,
    getUserId: () => userProfile.value?.id || undefined,
    createTools: tools.createCssTools,
    getSessionContext: () => 'Global XMCL custom CSS scope.',
  })
  void (async () => {
    const raw = localStorage.getItem('cssAgentConversationV1')
    if (raw) {
      try {
        const saved = JSON.parse(raw)
        await service.importLegacyConversation({
          key: { agentId: 'css', scope: 'global' },
          messages: saved.messages ?? [],
          updatedAt: saved.updatedAt,
        })
        localStorage.removeItem('cssAgentConversationV1')
      } catch {}
    }
    await local.load()
  })()
  return local
}
