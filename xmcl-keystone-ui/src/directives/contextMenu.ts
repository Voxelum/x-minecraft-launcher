import { ObjectDirective } from 'vue'
import { ContextMenuItem, useContextMenu } from '../composables/contextMenu'

type Binding = undefined | (ContextMenuItem[]) | (() => ContextMenuItem[])

const handlers = new WeakMap<HTMLElement, (e: MouseEvent) => void>()

export const vContextMenu: ObjectDirective<HTMLElement, Binding> = {
  mounted(el, bindings) {
    const { open } = useContextMenu()
    const handler = (e: MouseEvent) => {
      const value = bindings.value
      const items = value instanceof Array
        ? value
        : typeof value === 'function'
          ? value()
          : undefined
      if (items instanceof Array && items.length > 0) {
        open(e.clientX, e.clientY, items)
        e.preventDefault()
        e.stopPropagation()
      }
    }
    handlers.set(el, handler)
    el.addEventListener('contextmenu', handler)
  },
  beforeUnmount(el) {
    const handler = handlers.get(el)
    if (handler) {
      el.removeEventListener('contextmenu', handler)
      handlers.delete(el)
    }
  },
}
