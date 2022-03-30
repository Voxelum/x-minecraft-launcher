import { onMounted, onUnmounted, ref } from '@vue/composition-api'

export function useDropLink() {
  const inside = ref(false)

  function onDragLeave(e: DragEvent) {
    if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === 'copyLink') {
      inside.value = false
    }
  }
  function onDragEnter(e: DragEvent) {
    if ((e as any).fromElement === null && e.dataTransfer!.effectAllowed === 'copyLink') {
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
