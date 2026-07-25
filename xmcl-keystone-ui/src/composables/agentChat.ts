import { useEventBus } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useNotifier } from './notifier'
import { useAgentSettings } from './agent/settings'

const AGENT_CHAT_BUS_KEY = 'app:agent-chat'
const agentChatShown = ref(false)
const agentChatRunning = ref(false)

export type AgentChatEvent = 'show' | 'hide' | 'toggle' | 'show-css' | { type: 'show'; prompt?: string }

export function useAgentChatBus() {
  return useEventBus<AgentChatEvent>(AGENT_CHAT_BUS_KEY)
}

export function useAgentChatStatus() {
  return {
    shown: agentChatShown,
    running: agentChatRunning,
  }
}

export function useAgentChatEntry() {
  const bus = useAgentChatBus()
  const settings = useAgentSettings()
  const router = useRouter()
  const { t } = useI18n()
  const { notify } = useNotifier()

  async function open() {
    try {
      await settings.ready
    } catch (error) {
      notify({
        level: 'error',
        title: t('agent.notConfiguredTitle'),
        body: error instanceof Error ? error.message : String(error),
      })
      return
    }
    if (settings.configured.value) {
      bus.emit('show')
      return
    }
    notify({
      level: 'warning',
      title: t('agent.notConfiguredTitle'),
      body: t('agent.notConfiguredHint'),
      operations: [{
        text: t('agent.openSettings'),
        icon: 'settings',
        handler: () => {
          void router.push({ path: '/setting', query: { target: 'agent' } })
        },
      }],
    })
  }

  return {
    configured: settings.configured,
    open,
  }
}

/**
 * Resolve the Agnes AI setup guide URL for a launcher locale. The guide is
 * only authored in `en`, `zh`, `ru` and `uk`; everything else falls back to
 * English so the link never 404s.
 */
export function getAgnesSetupDocUrl(locale: string): string {
  const l = (locale || '').toLowerCase()
  let docLocale = 'en'
  if (l.startsWith('zh')) docLocale = 'zh'
  else if (l.startsWith('ru')) docLocale = 'ru'
  else if (l.startsWith('uk')) docLocale = 'uk'
  return `https://xmcl.app/${docLocale}/guide/agnes-ai-setup`
}

/** Reactive Agnes setup guide URL matching the active UI locale. */
export function useAgnesSetupDocUrl() {
  const { locale } = useI18n()
  return computed(() => getAgnesSetupDocUrl(locale.value))
}

/**
 * Bind Ctrl/Cmd+Shift+A to toggle the agent chat drawer. Mirrors the
 * command-palette hotkey pattern in commandPalette.ts.
 */
export function useAgentChatHotkey(enabled: Ref<boolean> = ref(true)) {
  const bus = useAgentChatBus()
  function onKeyDown(e: KeyboardEvent) {
    if (!enabled.value) return
    const mod = e.ctrlKey || e.metaKey
    if (!mod || !e.shiftKey) return
    if (e.code === 'KeyA') {
      e.preventDefault()
      bus.emit('toggle')
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
