import { Ref } from 'vue'

export function useTextFieldBehavior(searchTextField: Ref<any>, searchTextFieldFocused: Ref<boolean>) {
  return (e: KeyboardEvent) => {
    // ctrl+f
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault()
      e.stopPropagation()
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
  }
}
