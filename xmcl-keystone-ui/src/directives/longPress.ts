import { FunctionDirective } from 'vue'

export const vLongPress: FunctionDirective<HTMLElement, (...args: any[]) => void> = (el, bindings, n, prevN) => {
  let timeout: ReturnType<typeof setTimeout>
  if (prevN.tag) return
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
