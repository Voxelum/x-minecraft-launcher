import { ObjectDirective } from 'vue'

const listenerMap: Map<HTMLElement, [Function, Function]> = new Map()

export const vFocusOnSearch: ObjectDirective<HTMLElement, (show: boolean) => boolean> = {
  bind(el, bindings, vnode) {
    function handleKeydown(e: KeyboardEvent) {
      if (e.code === 'KeyF' && (e.ctrlKey || e.metaKey)) {
        if (vnode.componentInstance && 'focus' in vnode.componentInstance) {
          (vnode.componentInstance as any).focus()
        } else {
          el.focus()
        }
        if (bindings.value(true)) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }
    function handleKeyup(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (vnode.componentInstance && 'blur' in vnode.componentInstance) {
          (vnode.componentInstance as any).blur()
        } else {
          el.blur()
        }
        if (bindings.value(false)) {
          e.preventDefault()
          e.stopPropagation()
        }
      }
    }
    document.addEventListener('keyup', handleKeyup)
    document.addEventListener('keydown', handleKeydown)
    listenerMap.set(el, [handleKeydown, handleKeyup])
  },
  unbind(el, bindings) {
    const cache = listenerMap.get(el)
    if (cache) {
      const [keydown, keyup] = cache
      document.removeEventListener('keydown', keydown as any)
      document.removeEventListener('keyup', keyup as any)
    }
  },
}
