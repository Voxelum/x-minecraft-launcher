import { FunctionDirective } from '@vue/composition-api'

export const vFocusOnSearch: FunctionDirective<HTMLElement, (show: boolean) => boolean> = (el, bindings) => {
  function handleKeydown(e: KeyboardEvent) {
    if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
      el.focus()
      if (bindings.value(true)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }
  function handleKeyup(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (bindings.value(false)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
  }
  onMounted(() => {
    document.addEventListener('keyup', handleKeyup)
    document.addEventListener('keydown', handleKeydown)
  })
  onUnmounted(() => {
    document.removeEventListener('keyup', handleKeyup)
    document.removeEventListener('keydown', handleKeydown)
  })
}
