import Vue from 'vue'

Vue.directive('draggable-card', (el) => {
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
})

Vue.directive('selectable-card', (el) => {
  el.addEventListener('mousedown', (e) => {
    el.classList.add('selected')
  })
  const removeClass = () => {
    el.classList.remove('selected')
  }
  el.addEventListener('mouseup', removeClass)
  el.addEventListener('mouseleave', removeClass)
  el.addEventListener('dragend', removeClass)
})

Vue.directive('data-transfer', (el, binding) => {
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setData(binding.arg!, binding.value)
  })
})

Vue.directive('data-transfer-image', (el, binding) => {
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer!.effectAllowed = 'move'
    e.dataTransfer!.setDragImage(binding.value, 0, 0)
  })
})
