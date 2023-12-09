import { SharedTooltipData, useSharedTooltipData } from '@/composables/sharedTooltip'
import { FunctionDirective } from 'vue'

export const vSharedTooltip: FunctionDirective<HTMLElement, ((v?: any) => string) | string | [string, string]> = (el, bindings, node, prevNode) => {
  if (prevNode.tag) return
  const { blocked, data, isShown, stack, shouldPushStack, setValue } = useSharedTooltipData()
  el.addEventListener('mouseenter', (e) => {
    if (blocked.value) return
    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    if (shouldPushStack() && data.value) {
      stack.push(data.value)
    }

    const newData: SharedTooltipData = {
      text: '',
      direction: 'top',
      x: 0,
      y: 0,
      color: 'black',
    }
    if (bindings.modifiers.left) {
      newData.direction = 'left'
    } else if (bindings.modifiers.right) {
      newData.direction = 'right'
    } else if (bindings.modifiers.bottom) {
      newData.direction = 'bottom'
    } else {
      newData.direction = 'top'
    }

    if (newData.direction === 'top') {
      newData.x = rect.x + rect.width / 2
      newData.y = rect.y - 0
    } else if (newData.direction === 'bottom') {
      newData.x = rect.x + rect.width / 2
      newData.y = rect.y + rect.height + 0
    } else if (newData.direction === 'right') {
      newData.x = rect.x + rect.width + 0
      newData.y = rect.y + rect.height / 2
    } else {
      newData.x = rect.x
      newData.y = rect.y + rect.width / 2
    }

    const val = bindings.value
    if (typeof val === 'string') {
      newData.text = val
    } else if (val instanceof Array) {
      newData.text = val[0]
      newData.color = val[1]
    } else if (typeof val === 'function') {
      newData.text = val()
    }

    data.value = newData
    isShown.value = false
    setValue(true)
  })
  el.addEventListener('click', (e) => {
    if (blocked.value) return
    stack.pop()
    setValue(false)
  })
  el.addEventListener('mouseleave', (e) => {
    if (blocked.value) return
    const last = stack.pop()
    if (last) {
      data.value = last
      setValue(true)
    } else {
      setValue(false)
    }
  })
  el.addEventListener('DOMNodeRemoved', (e) => {
    stack.pop()
    setValue(false)
  })
}
