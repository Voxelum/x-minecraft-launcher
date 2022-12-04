import { Ref } from 'vue'
import { ModItem } from './mod'

export function useModSelection(items: Ref<ModItem[]>) {
  const isSelectionMode = ref(false)
  const selectedItems = computed(() => items.value.filter(i => i.selected))

  function select(start: number, end: number, value = true) {
    if (!isSelectionMode.value) {
      isSelectionMode.value = true
    }
    for (let i = start; i < end; ++i) {
      items.value[i].selected = value
    }
  }
  function selectOrUnselect(mod: ModItem) {
    if (isSelectionMode.value) {
      mod.selected = !mod.selected
    }
  }
  let lastIndex = -1
  function onClick(event: MouseEvent, index: number) {
    if (lastIndex !== -1 && event.shiftKey) {
      let min = lastIndex
      let max = index
      if (lastIndex > index) {
        max = lastIndex
        min = index
      }
      select(min + 1, max, items.value[lastIndex].selected)
    }
    if (event.ctrlKey) {
      if (!isSelectionMode.value) {
        isSelectionMode.value = true
      }
    }
    selectOrUnselect(items.value[index])
    lastIndex = index
  }
  function onKeyup(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      isSelectionMode.value = false
      for (const item of items.value) {
        item.selected = false
      }
    }
  }
  function onKeyDown(e: KeyboardEvent) {
    if ((e.key === 'a') && e.ctrlKey) {
      console.log(`${items.value.length} select`)
      select(0, items.value.length)
      e.preventDefault()
      return false
    }
    return true
  }
  function onEnable({ item, enabled }: { item: ModItem; enabled: boolean }) {
    if (item.selected) {
      selectedItems.value.forEach(i => { i.enabled = enabled })
    } else {
      item.enabled = enabled
    }
  }
  onMounted(() => {
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyup)
  })
  onUnmounted(() => {
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('keyup', onKeyup)
  })
  return {
    selectedItems,
    onEnable,
    onClick,
    select,
    isSelectionMode,
  }
}
