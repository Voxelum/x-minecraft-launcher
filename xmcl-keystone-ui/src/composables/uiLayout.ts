import { injection } from '@/util/inject'
import { InjectionKey } from 'vue'
import { useLocalStorageCacheStringValue } from './cache'

export function useUILayout() {
  const layout = useLocalStorageCacheStringValue('ui_layout', 'default' as 'default' | 'focus')
  return layout
}

export function useInFocusMode() {
  return injection(kInFocusMode)
}

export const kInFocusMode: InjectionKey<Ref<boolean>> = Symbol('InFocusMode')

export const kUILayout: InjectionKey<ReturnType<typeof useUILayout>> = Symbol('UILayout')
