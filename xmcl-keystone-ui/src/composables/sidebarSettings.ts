import { InjectionKey, Ref } from 'vue'
import { useLocalStorageCacheStringValue, useLocalStorageCacheInt, useLocalStorageCacheBool } from './cache'
import { useLocalStorage } from '@vueuse/core'
import { injection } from '@/util/inject'

export type SidebarPosition = 'left' | 'right' | 'top' | 'bottom'
export type SidebarStyle = 'classic' | 'notch'
export type SidebarAlign = 'start' | 'center' | 'end'

export interface SidebarSettings {
  position: Ref<SidebarPosition>
  style: Ref<SidebarStyle>
  align: Ref<SidebarAlign>
  scale: Ref<number>
  autoHide: Ref<boolean>
  showOnlyPinned: Ref<boolean>
  pinnedInstances: Ref<string[]>
}

export const kSidebarSettings: InjectionKey<SidebarSettings> = Symbol('SidebarSettings')

export function useSidebarSettings(): SidebarSettings {
  const position = useLocalStorageCacheStringValue('sidebar_position', 'left' as SidebarPosition)
  const style = useLocalStorageCacheStringValue('sidebar_style', 'classic' as SidebarStyle)
  const align = useLocalStorageCacheStringValue('sidebar_align', 'center' as SidebarAlign)
  const scale = useLocalStorageCacheInt('sidebar_scale', 100)
  const autoHide = useLocalStorageCacheBool('sidebar_autoHide', false)
  const showOnlyPinned = useLocalStorageCacheBool('sidebar_showOnlyPinned', false)
  const pinnedInstances = useLocalStorage<string[]>('sidebar_pinnedInstances', [])

  return {
    position,
    style,
    align,
    scale,
    autoHide,
    showOnlyPinned,
    pinnedInstances,
  }
}

export function useInjectSidebarSettings(): SidebarSettings {
  return injection(kSidebarSettings)
}
