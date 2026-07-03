import { InjectionKey, Ref } from 'vue'
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
  const position = useLocalStorage<SidebarPosition>('sidebar_position', 'left', { writeDefaults: false })
  const style = useLocalStorage<SidebarStyle>('sidebar_style', 'classic', { writeDefaults: false })
  const align = useLocalStorage<SidebarAlign>('sidebar_align', 'center', { writeDefaults: false })
  const scale = useLocalStorage('sidebar_scale', 100, { writeDefaults: false })
  const autoHide = useLocalStorage('sidebar_autoHide', true, { writeDefaults: false })
  const showOnlyPinned = useLocalStorage('sidebar_showOnlyPinned', false, { writeDefaults: false })
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
