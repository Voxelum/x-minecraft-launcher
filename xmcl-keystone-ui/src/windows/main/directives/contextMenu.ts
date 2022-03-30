import Vue from 'vue'
import { useContextMenu } from '../composables/contextMenu'

Vue.directive('context-menu', (el, bindings) => {
  const { open } = useContextMenu()
  el.addEventListener('contextmenu', (e) => {
    if (bindings.value.length > 0) {
      open(e.clientX, e.clientY, bindings.value)
    }
  })
})
