import { ref } from 'vue'
import { useDialog } from './dialog'

export type OmniDialogMode = 'command' | 'agent'

const mode = ref<OmniDialogMode>('command')
const commandInput = ref('')
const agentInput = ref('')

export function useOmniDialog() {
  // Registers under the shared dialog model so opening the omni surface
  // closes any other useDialog-based dialog, and vice versa.
  const { isShown: shown, show: showDialog, hide: close } = useDialog<OmniDialogMode>('omni')

  function open(nextMode: OmniDialogMode) {
    mode.value = nextMode
    showDialog(nextMode)
  }

  function toggle(nextMode: OmniDialogMode) {
    if (shown.value && mode.value === nextMode) {
      close()
    } else {
      open(nextMode)
    }
  }

  return {
    shown,
    mode,
    commandInput,
    agentInput,
    open,
    close,
    toggle,
  }
}