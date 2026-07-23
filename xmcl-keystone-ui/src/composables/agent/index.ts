import { AgentServiceKey, type AgentMessage, type AgentRunEvent } from '@xmcl/runtime-api'
import type { InjectionKey, Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { kInstances } from '../instances'
import { useService } from '../service'
import { kUserContext } from '../user'
import { injection } from '@/util/inject'
import { useRemoteAgent } from './remote'
import { createAgentUiHandler } from './ui'

export * from './remote'
export * from './ui'
export * from './cssAgent'

export interface AgentSession {
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly messages: Ref<AgentMessage[]>
  readonly events: Ref<AgentRunEvent[]>
  loadConversationForCurrentInstance(): Promise<void>
  send(userInput: string, options?: { maxTurns?: number }): Promise<void>
  reset(): Promise<void>
  abort(): void
}

function legacyMessage(message: any): AgentMessage {
  let content = message.content ?? null
  if (Array.isArray(content)) {
    content = content.map((part: any) => part.type === 'text'
      ? { type: 'text', text: String(part.text ?? '') }
      : { type: 'image_url', image_url: part.image_url })
  }
  return {
    role: message.role,
    content,
    toolCalls: message.tool_calls?.map((call: any) => {
      let args = {}
      try { args = JSON.parse(call.function.arguments || '{}') } catch {}
      return { id: call.id, name: call.function.name, arguments: args }
    }),
    toolCallId: message.tool_call_id,
    name: message.name,
  }
}

export function useAgent(): AgentSession {
  const router = useRouter()
  const { locale } = useI18n()
  const { selectedInstance } = injection(kInstances)
  const { userProfile, select } = injection(kUserContext)
  const service = useService(AgentServiceKey)
  const remote = useRemoteAgent({
    agentId: 'launcher',
    getScope: () => selectedInstance.value,
    getLocale: () => locale.value,
    getUserId: () => userProfile.value?.id || undefined,
    handleUi: createAgentUiHandler({ router, selectedInstance, selectAccount: select }),
  })

  void (async () => {
    const raw = localStorage.getItem('agentConversationByInstanceV1')
    if (!raw) return
    try {
      const store = JSON.parse(raw)
      for (const [scope, saved] of Object.entries<any>(store?.byInstance ?? {})) {
        await service.importLegacyConversation({
          key: { agentId: 'launcher', scope },
          messages: (saved.messages ?? []).map(legacyMessage),
          context: saved.snapshot,
          updatedAt: saved.updatedAt,
        })
      }
      localStorage.removeItem('agentConversationByInstanceV1')
    } catch {}
  })()

  return {
    ...remote,
    loadConversationForCurrentInstance: () => remote.load(selectedInstance.value),
  }
}

export const kAgent: InjectionKey<AgentSession> = Symbol('Agent')

export function installAgentDevLauncher(session: AgentSession) {
  ;(window as any).__xmcl_agent = {
    send: (input: string) => session.send(input).catch((error) => console.error('[agent]', error)),
    reset: () => session.reset(),
    abort: () => session.abort(),
    get running() { return session.running.value },
    get messages() { return session.messages.value },
    get events() { return session.events.value },
  }
  watch(session.available, available => {
    console.info(available ? '[agent] ready' : '[agent] disabled (API key missing)')
  }, { immediate: true })
}
