import { useEventListener } from '@vueuse/core'
import { Ref } from 'vue'

export function useTextFieldBehavior(
  searchTextField: Ref<any>,
  searchTextFieldFocused: Ref<boolean>,
) {
  useEventListener(
    document,
    'keydown',
    (e: KeyboardEvent) => {
      // ctrl+f
      if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault()
        // e.stopPropagation()
        searchTextField.value?.focus()
      }
      // ctrl+a
      if (searchTextFieldFocused.value && e.ctrlKey && e.code === 'KeyA') {
        e.preventDefault()
        e.stopPropagation()
        searchTextField.value?.$el.querySelector('input')?.select()
      }
      // esc
      if (searchTextFieldFocused.value && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        searchTextField.value?.blur()
      }
    },
    { capture: true },
  )
}
