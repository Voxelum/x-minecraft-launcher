import { injection } from '@/util/inject'
import { InjectionKey } from 'vue'
import { useLocalStorageCacheStringValue } from './cache'

export function useUILayout() {
  const layout = useLocalStorageCacheStringValue('ui_layout', 'default' as 'default' | 'focus')
  return layout
}

export function useInFocusMode() {
  const layout = injection(kUILayout)
  return computed(() => layout.value === 'focus')
}

export const kUILayout: InjectionKey<ReturnType<typeof useUILayout>> = Symbol('UILayout')
