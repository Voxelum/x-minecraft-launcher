import { FunctionDirective } from 'vue'

export const vDragover: FunctionDirective<HTMLElement> = (el, binding) => {
  let count = 0
  el.addEventListener('dragenter', (e) => {
    const lastCount = count
    count += 1
    if (lastCount === 0) {
      el.classList.add('dragover')
    }
  })
  el.addEventListener('dragleave', (e) => {
    count -= 1
    if (count === 0) {
      el.classList.remove('dragover')
    }
  })
  el.addEventListener('drop', (e) => {
    count -= 1
    if (count === 0) {
      el.classList.remove('dragover')
    }
  })
}
