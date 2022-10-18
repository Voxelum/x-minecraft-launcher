import { Ref, watch, onUnmounted, ref, onMounted } from 'vue'

export function useDraggableElem (
  elem: Ref<HTMLElement | null>,
  dragging = ref(false),
) {
  function onMouseDown () {
    dragging.value = true
  }
  function onDragEnd () {
    dragging.value = false
  }
  onMounted(() => {
    const e = elem.value!
    e.addEventListener('mousedown', onMouseDown)
    e.addEventListener('dragend', onDragEnd)
  })
  onUnmounted(() => {
    const e = elem.value!
    e.removeEventListener('mousedown', onMouseDown)
    e.removeEventListener('dragend', onDragEnd)
  })
  return {
    dragging,
  }
}

export function useDrop (
  callback: (file: File) => void,
) {
  function onDrop (event: DragEvent) {
    if (!event.dataTransfer) return
    event.preventDefault()
    const length = event.dataTransfer.files.length
    if (length > 0) {
      for (let i = 0; i < length; ++i) {
        callback(event.dataTransfer.files[i])
      }
    }
  }
  return { onDrop }
}

export function useDropElem (
  elem: Ref<HTMLElement | null>,
  callback: (file: File) => void,
) {
  function onDrop (event: DragEvent) {
    if (!event.dataTransfer) return
    event.preventDefault()
    const length = event.dataTransfer.files.length
    if (length > 0) {
      for (let i = 0; i < length; ++i) {
        callback(event.dataTransfer.files[i])
      }
    }
  }
  const handle = watch(elem, (n, o) => {
    if (o) {
      o.removeEventListener('drop', onDrop)
    }
    if (n) {
      n.addEventListener('drop', onDrop)
    }
  })
  onUnmounted(() => {
    if (elem.value) {
      elem.value.removeEventListener('drop', onDrop)
    }
    handle()
  })
}
