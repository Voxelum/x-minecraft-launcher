import { computed, onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useNotifier } from './notifier'
import { useAgentConfirmation } from './agent/confirm'
import { useAgentSettings } from './agent/settings'
import { useOmniDialog } from './omniDialog'

const agentChatRunning = ref(false)
// Which agent the chat surface should select the next time it transitions
// from hidden to shown; consumed and reset by AppAgentChat's open watcher.
const pendingAgentKind = ref<'common' | 'css'>('common')

export function usePendingAgentKind() {
  return pendingAgentKind
}

export function useAgentChatStatus() {
  const surface = useOmniDialog()
  const confirmation = useAgentConfirmation()
  return {
    shown: computed({
      get: () => surface.shown.value && surface.mode.value === 'agent',
      set: (value) => {
        if (value) surface.open('agent')
        else if (surface.mode.value === 'agent') surface.close()
      },
    }),
    running: agentChatRunning,
    confirmationPending: confirmation.shown,
  }
}

/** Open the agent chat, optionally prefilling the input and/or selecting the CSS assistant. */
export function useAgentChatOpen() {
  const status = useAgentChatStatus()
  const surface = useOmniDialog()
  function open(options?: { prompt?: string; kind?: 'common' | 'css' }) {
    pendingAgentKind.value = options?.kind ?? 'common'
    if (options?.prompt) surface.agentInput.value = options.prompt
    status.shown.value = true
  }
  return { open }
}

export function useAgentChatEntry() {
  const { open: openChat } = useAgentChatOpen()
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
      openChat()
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

/** Bind Ctrl/Cmd+Shift+A to open the agent chat. */
export function useAgentChatHotkey(enabled: Ref<boolean> = ref(true)) {
  const surface = useOmniDialog()
  function onKeyDown(e: KeyboardEvent) {
    if (!enabled.value) return
    const mod = e.ctrlKey || e.metaKey
    if (!mod || !e.shiftKey) return
    if (e.code === 'KeyA') {
      e.preventDefault()
      surface.open('agent')
    }
  }
  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
