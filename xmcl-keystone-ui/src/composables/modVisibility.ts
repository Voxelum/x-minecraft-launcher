import { Ref } from 'vue'
import { ModItem } from './mod'

export function useModVisibleFilter(items: Ref<ModItem[]>) {
  const visibleCount = ref(16)
  function onVisible(visible: boolean, index: number) {
    if (!visible) {
      // if (visibleCount.value > index + 40) {
      //   visibleCount.value = index + 40
      // }
    } else if (visibleCount.value < index + 8) {
      visibleCount.value += 8
    } else if (visibleCount.value > index + 40) {
      visibleCount.value -= 20
    }
  }
  const mods = computed(() => items.value.slice(0, visibleCount.value))
  return {
    items: mods,
    visibleCount,
    onVisible,
  }
}
