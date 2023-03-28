import { useSharedTooltipData } from '@/composables/sharedTooltip'
import { FunctionDirective } from 'vue'

export const vSharedTooltip: FunctionDirective<HTMLElement, string> = (el, bindings) => {
  const { currentTooltip, x, y, color, left, isShown } = useSharedTooltipData()
  el.addEventListener('mouseenter', (e) => {
    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    if (bindings.modifiers.left) {
      left.value = true
    } else {
      left.value = false
    }
    if (!left.value) {
      x.value = rect.x + rect.width / 2
      y.value = rect.y - 0
    } else {
      x.value = rect.x
      y.value = rect.y + rect.width / 2
    }
    currentTooltip.value = bindings.value
    isShown.value = true
  })
  el.addEventListener('click', (e) => {
    isShown.value = false
  })
  el.addEventListener('mouseleave', (e) => {
    isShown.value = false
  })
  el.addEventListener('DOMNodeRemoved', (e) => {
    left.value = false
    isShown.value = false
  })
}
