import { FunctionDirective } from 'vue'

export const vLongPress: FunctionDirective<HTMLElement, (...args: any[]) => void> = (el, bindings) => {
  let timeout: ReturnType<typeof setTimeout>
  el.addEventListener('mousedown', (e) => {
    timeout = setTimeout(() => {
      bindings.value.call(undefined, e)
    }, 1000)
  })
  el.addEventListener('dragstart', () => {
    clearTimeout(timeout)
  })
  el.addEventListener('mouseleave', () => {
    clearTimeout(timeout)
  })
  el.addEventListener('mouseup', () => {
    clearTimeout(timeout)
  })
}
