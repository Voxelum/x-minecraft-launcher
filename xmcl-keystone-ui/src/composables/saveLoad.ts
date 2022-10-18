import { onMounted, onActivated, onDeactivated, onUnmounted } from 'vue'

export function useAutoSaveLoad (save: () => void, load: () => void) {
  onMounted(() => load())
  onActivated(() => load())
  onDeactivated(() => save())
  onUnmounted(() => save())
}
