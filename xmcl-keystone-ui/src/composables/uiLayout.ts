import { injection } from '@/util/inject'
import { InjectionKey } from 'vue'
import { useLocalStorageCacheStringValue } from './cache'

export function useUILayout() {
  const layout = useLocalStorageCacheStringValue('ui_layout', 'focus' as 'default' | 'focus')
  return layout
}

export function useInFocusMode() {
  return injection(kInFocusMode)
}
/**
 * Represent whether the UI is in focus mode
 */
export const kInFocusMode: InjectionKey<Ref<boolean>> = Symbol('InFocusMode')
/**
 * Represent the default layout mode
 */
export const kUIDefaultLayout: InjectionKey<ReturnType<typeof useUILayout>> = Symbol('UILayout')
