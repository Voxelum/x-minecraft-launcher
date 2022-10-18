import { FunctionDirective } from 'vue'

export const vDraggableCard: FunctionDirective<HTMLElement> = (el) => {
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer!.effectAllowed = 'move'
    el.classList.add('dragged')
  })
  const removeClass = () => {
    el.classList.remove('dragged')
  }
  el.addEventListener('mouseup', removeClass)
  el.addEventListener('mouseleave', removeClass)
  el.addEventListener('dragend', removeClass)
}

export const vSelectableCard: FunctionDirective<HTMLElement> = (el) => {
  el.addEventListener('mousedown', (e) => {
    el.classList.add('selected')
  })
  const removeClass = () => {
    el.classList.remove('selected')
  }
  el.addEventListener('mouseup', removeClass)
  el.addEventListener('mouseleave', removeClass)
  el.addEventListener('dragend', removeClass)
}

export const vDataTransfer: FunctionDirective<HTMLElement> = (el, binding) => {
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData(binding.arg!, binding.value)
  })
}

export const vDataTransferImage: FunctionDirective<HTMLElement> = (el, binding) => {
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setDragImage(binding.value, 0, 0)
  })
}
