import { AgentServiceKey, type AgentMessage, type AgentRunEvent } from '@xmcl/runtime-api'
import type { InjectionKey, Ref } from 'vue'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { kInstances } from '../instances'
import { useService } from '../service'
import { kUserContext } from '../user'
import { injection } from '@/util/inject'
import { useLocalAgent } from './local'
import { useAgentToolFactory } from './tools'
import { useAgentChatStatus } from '../agentChat'
import { migrateLegacyLauncherConversations } from './migration'

export * from './local'
export * from './ui'
export * from './cssAgent'

export interface AgentSession {
  readonly available: Readonly<Ref<boolean>>
  readonly running: Ref<boolean>
  readonly runError: Ref<string>
  readonly messages: Ref<AgentMessage[]>
  readonly events: Ref<AgentRunEvent[]>
  loadConversationForCurrentInstance(): Promise<void>
  replaceMessages(messages: AgentMessage[]): Promise<void>
  send(userInput: string): Promise<void>
  reset(): Promise<void>
  abort(): void
}

export function useAgent(): AgentSession {
  const { locale } = useI18n()
  const { allInstances, selectedInstance } = injection(kInstances)
  const { userProfile } = injection(kUserContext)
  const service = useService(AgentServiceKey)
  const tools = useAgentToolFactory()
  const local = useLocalAgent({
    agentId: 'launcher',
    getScope: () => selectedInstance.value,
    getLocale: () => locale.value,
    getUserId: () => userProfile.value?.id || undefined,
    createTools: tools.createLauncherTools,
    getSessionContext: context => {
      const instance = allInstances.value.find(value => value.path === context.scope)
      return [
        `Instance path: ${context.scope}`,
        `Instance name: ${instance?.name ?? '(unknown)'}`,
        `Runtime: ${JSON.stringify(instance?.runtime ?? {})}`,
        `Selected user id: ${context.userId ?? '(none)'}`,
      ].join('\n')
    },
  })

  const migrationReady = migrateLegacyLauncherConversations(service)
  watch(selectedInstance, (scope) => {
    if (scope) void migrationReady.then(() => local.load(scope))
  }, { immediate: true })

  return {
    ...local,
    loadConversationForCurrentInstance: async () => {
      await migrationReady
      await local.load(selectedInstance.value)
    },
  }
}

export const kAgent: InjectionKey<AgentSession> = Symbol('Agent')

export function installAgentDevLauncher(session: AgentSession, enabled: Ref<boolean>) {
  const chatStatus = useAgentChatStatus()
  const surface = {
    send: (input: string) => session.send(input).catch((error) => console.error('[agent]', error)),
    reset: () => session.reset(),
    abort: () => session.abort(),
    show: () => { chatStatus.shown.value = true },
    hide: () => { chatStatus.shown.value = false },
    get running() { return session.running.value },
    get runError() { return session.runError.value },
    get messages() { return session.messages.value },
    get events() { return session.events.value },
    setMessages: (messages: AgentMessage[]) => session.replaceMessages(messages),
  }
  // Only expose the debug surface while developer mode is on; the whole agent
  // feature is developer-mode gated, so it is never present on a default install.
  watch(enabled, (on) => {
    if (on) (window as any).__xmcl_agent = surface
    else delete (window as any).__xmcl_agent
  }, { immediate: true })
  watch(session.available, available => {
    console.info(available ? '[agent] ready' : '[agent] disabled (API key missing)')
  }, { immediate: true })
}
