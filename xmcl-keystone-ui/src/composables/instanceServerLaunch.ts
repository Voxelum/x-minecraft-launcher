import { InjectionKey } from 'vue'

export const kInstanceServerLaunch: InjectionKey<ReturnType<typeof useInstanceServerLaunch>> = Symbol('InstanceServerLaunch')

/**
 * Shared state + action bridge for launching the dedicated local server.
 *
 * The heavy configuration UI lives in `BaseSettingServerRun.vue`, which
 * registers its launch/kill handlers and mirrors its readiness state here so
 * the header (`BaseSettingExtension.vue`) can show the primary action button.
 */
export function useInstanceServerLaunch() {
  const loading = ref(false)
  /** Whether the server can be launched (EULA accepted). */
  const canLaunch = ref(false)
  /** Whether a dedicated server process is currently running. */
  const running = ref(false)
  /** Whether the run-server view is mounted (so the header should show its action). */
  const active = ref(false)

  let onLaunch: (() => Promise<void> | void) | undefined
  let onKill: (() => void) | undefined

  function setHandlers(handlers: {
    launch?: () => Promise<void> | void
    kill?: () => void
  }) {
    onLaunch = handlers.launch
    onKill = handlers.kill
  }

  async function launchServer() {
    if (loading.value || !onLaunch) return
    try {
      loading.value = true
      await onLaunch()
    } finally {
      loading.value = false
    }
  }

  function killServer() {
    onKill?.()
  }

  return {
    loading,
    canLaunch,
    running,
    active,
    setHandlers,
    launchServer,
    killServer,
  }
}
