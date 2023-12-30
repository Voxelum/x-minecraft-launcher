import { FunctionDirective, Ref } from 'vue'
import { ContextMenuItem, useContextMenu } from '../composables/contextMenu'

export const vContextMenu: FunctionDirective<HTMLElement, undefined | (ContextMenuItem[]) | (() => ContextMenuItem[])> = (el, bindings, node, prevNode) => {
  if (prevNode.elm === el && !bindings.modifiers.force) return
  const { open } = useContextMenu()
  el.addEventListener('contextmenu', (e) => {
    if (bindings.value instanceof Array && bindings.value.length > 0) {
      open(e.clientX, e.clientY, bindings.value)
      e.preventDefault()
      e.stopPropagation()
    } else if (typeof bindings.value === 'function') {
      open(e.clientX, e.clientY, bindings.value())
      e.preventDefault()
      e.stopPropagation()
    }
  })
}
