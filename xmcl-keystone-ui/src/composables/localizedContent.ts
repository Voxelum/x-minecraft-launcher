import { useKeyModifier, useLocalStorage } from '@vueuse/core'
import { InjectionKey } from 'vue'

export const kLocalizedContent: InjectionKey<ReturnType<typeof useLocalizedContentControl>> = Symbol('localizedContent')

export function useLocalizedContentControl() {
  const isEnabledState = useLocalStorage('displayLocalizedCommunityContent', true)

  const isControl = useKeyModifier('Alt')

  const isEnabled = computed(() => isControl.value ? !isEnabledState.value : isEnabledState.value)

  return {
    isEnabledState,
    isEnabled,
  }
}
