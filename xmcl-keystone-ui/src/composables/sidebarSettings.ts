import { InjectionKey, Ref } from 'vue'
import { useLocalStorageCacheStringValue, useLocalStorageCacheInt, useLocalStorageCacheBool } from './cache'
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
}

export const kSidebarSettings: InjectionKey<SidebarSettings> = Symbol('SidebarSettings')

export function useSidebarSettings(): SidebarSettings {
  const position = useLocalStorageCacheStringValue('sidebar_position', 'left' as SidebarPosition)
  const style = useLocalStorageCacheStringValue('sidebar_style', 'classic' as SidebarStyle)
  const align = useLocalStorageCacheStringValue('sidebar_align', 'center' as SidebarAlign)
  const scale = useLocalStorageCacheInt('sidebar_scale', 100)
  const autoHide = useLocalStorageCacheBool('sidebar_autoHide', false)

  return {
    position,
    style,
    align,
    scale,
    autoHide,
  }
}

export function useInjectSidebarSettings(): SidebarSettings {
  return injection(kSidebarSettings)
}

