import { FunctionDirective, Ref } from '@vue/composition-api'
import Vue from 'vue'
import { ContextMenuItem, useContextMenu } from '../composables/contextMenu'

export const vContextMenu: FunctionDirective<HTMLElement, ContextMenuItem[]> = (el, bindings) => {
  const { open } = useContextMenu()
  el.addEventListener('contextmenu', (e) => {
    if (bindings.value.length > 0) {
      open(e.clientX, e.clientY, bindings.value)
    }
  })
}
