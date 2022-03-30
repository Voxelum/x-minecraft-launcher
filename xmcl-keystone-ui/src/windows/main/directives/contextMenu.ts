import Vue from 'vue'
import { useContextMenu } from '../composables/contextMenu'

Vue.directive('context-menu', (el, bindings) => {
  const { open } = useContextMenu()
  el.addEventListener('contextmenu', (e) => {
    open(e.clientX, e.clientY, bindings.value)
  })
})
