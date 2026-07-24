import { AgentServiceKey } from '@xmcl/runtime-api'
import { useI18n } from 'vue-i18n'
import { kInstances } from '../instances'
import { useService } from '../service'
import { kUserContext } from '../user'
import { injection } from '@/util/inject'
import { useRemoteAgent, type RemoteAgentSession } from './remote'
import { createAgentUiHandler } from './ui'

export type CssAgentSession = RemoteAgentSession

export function useCssAgent(): CssAgentSession {
  const router = useRouter()
  const { locale } = useI18n()
  const { allInstances, selectedInstance } = injection(kInstances)
  const { userProfile, select } = injection(kUserContext)
  const service = useService(AgentServiceKey)
  const remote = useRemoteAgent({
    agentId: 'css',
    getScope: () => 'global',
    getLocale: () => locale.value,
    getUserId: () => userProfile.value?.id || undefined,
    handleUi: createAgentUiHandler({ router, selectedInstance, instances: allInstances, selectAccount: select }),
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
    await remote.load()
  })()
  return remote
}
