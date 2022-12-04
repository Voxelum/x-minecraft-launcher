import { Ref } from 'vue'
import { ModItem } from './mod'

export function useModDragging(items: Ref<ModItem[]>, selectedMods: Ref<ModItem[]>, isSelectionMode: Ref<boolean>) {
  const isDraggingMod = computed(() => items.value.some(i => i.dragged))

  function onItemDragstart(mod: ModItem) {
    if (isSelectionMode.value && mod.selected) {
      for (const item of selectedMods.value) {
        item.dragged = true
      }
    } else {
      mod.dragged = true
    }
  }
  function onDragEnd() {
    for (const item of items.value) {
      item.dragged = false
    }
  }
  return {
    isDraggingMod,
    onDragEnd,
    onItemDragstart,
  }
}
