import { useEventListener, useFocus } from '@vueuse/core'
import { Ref } from 'vue'

export function useTextFieldBehavior(searchTextField: Ref<any>) {
  const el = computed(() => searchTextField.value?.$el)
  const { focused: searchTextFieldFocused } = useFocus(el)
  useEventListener(el, 'keydown', (e: KeyboardEvent) => {
    // ctrl+f
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault()
      // e.stopPropagation()
      searchTextField.value?.focus()
    }
    // ctrl+a
    if (searchTextFieldFocused.value && e.ctrlKey && e.key === 'a') {
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
  })
}
