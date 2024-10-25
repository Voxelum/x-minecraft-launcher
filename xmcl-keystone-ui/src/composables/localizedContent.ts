import { useKeyModifier } from '@vueuse/core'
import { InjectionKey } from 'vue'

export const kLocalizedContent: InjectionKey<ReturnType<typeof useLocalizedContentControl>> = Symbol('localizedContent')

export function useLocalizedContentControl() {
  const isEnabledState = ref(true)

  const isControl = useKeyModifier('Alt')

  const isEnabled = computed(() => isControl.value ? !isEnabledState.value : isEnabledState.value)

  return {
    isEnabled,
  }
}
