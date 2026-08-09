import { useEventBus } from '@vueuse/core'

const saveBus = useEventBus<void>('modrinth-project-editor-save')
const state = reactive({
  available: false,
  dirty: false,
  saving: false,
})

export function useModrinthProjectEditorAction() {
  return {
    state: readonly(state),
    requestSave: () => saveBus.emit(),
    onSaveRequested: saveBus.on,
    setState: (value: Partial<typeof state>) => Object.assign(state, value),
  }
}