import { onMounted, onUnmounted, ref } from 'vue'

export function useDropLink(effect = 'copyLink') {
  const inside = ref(false)

  function onDragLeave(e: DragEvent) {
    if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === effect) {
      inside.value = false
    }
  }
  function onDragEnter(e: DragEvent) {
    if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === effect) {
      inside.value = true
    }
  }
  onMounted(() => {
    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragleave', onDragLeave)
  })
  onUnmounted(() => {
    document.removeEventListener('dragenter', onDragEnter)
    document.removeEventListener('dragleave', onDragLeave)
  })

  return { inside }
}
