import { useSharedTooltipData } from '@/composables/sharedTooltip'
import { FunctionDirective } from 'vue'

export const vSharedTooltip: FunctionDirective<HTMLElement, string | [string, string]> = (el, bindings, node, prevNode) => {
  if (prevNode.tag) return
  const { currentTooltip, x, y, color, left, stack, isShown } = useSharedTooltipData()
  el.addEventListener('mouseenter', (e) => {
    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    if (isShown.value) {
      stack.push([x.value, y.value, currentTooltip.value, color.value, left.value])
    }

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
    const val = bindings.value
    color.value = 'black'
    if (typeof val === 'string') {
      currentTooltip.value = val
    } else if (val instanceof Array) {
      currentTooltip.value = val[0]
      color.value = val[1]
    }
    isShown.value = true
  })
  el.addEventListener('click', (e) => {
    stack.pop()
    isShown.value = false
  })
  el.addEventListener('mouseleave', (e) => {
    const last = stack.pop()
    if (last) {
      x.value = last[0]
      y.value = last[1]
      currentTooltip.value = last[2]
      color.value = last[3]
      left.value = last[4]
      isShown.value = true
    } else {
      isShown.value = false
    }
  })
  el.addEventListener('DOMNodeRemoved', (e) => {
    stack.pop()
    left.value = false
    isShown.value = false
  })
}
