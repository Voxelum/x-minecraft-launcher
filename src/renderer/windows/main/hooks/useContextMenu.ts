import { inject, InjectionKey, Ref, provide, ref } from '@vue/composition-api'
import { requireNonnull } from '/@shared/util/assert'

export interface ContextMenuItem {
  text: string
  icon: string
  onClick: () => void
  children: ContextMenuItem[]
}

export const CONTEXT_MENU_X: InjectionKey<Ref<number>> = Symbol('CONTEXT_MENU_X')
export const CONTEXT_MENU_Y: InjectionKey<Ref<number>> = Symbol('CONTEXT_MENU_Y')
export const CONTEXT_MENU_ITEMS: InjectionKey<Ref<ContextMenuItem[]>> = Symbol('CONTEXT_MENU_ITEMS')
export const CONTEXT_MENU_SHOWN: InjectionKey<Ref<boolean>> = Symbol('CONTEXT_MENU_SHOWN')

export function useContextMenu () {
  const cx = inject(CONTEXT_MENU_X)
  const cy = inject(CONTEXT_MENU_Y)
  const citems = inject(CONTEXT_MENU_ITEMS)
  const cshown = inject(CONTEXT_MENU_SHOWN)
  requireNonnull(cx)
  requireNonnull(cy)
  requireNonnull(citems)
  requireNonnull(cshown)
  const zx = cx
  const zy = cy
  const zitems = citems
  const zshown = cshown
  function open (x: number, y: number, items: ContextMenuItem[]) {
    zx.value = x
    zy.value = y
    zitems.value = items
    zshown.value = true
  }
  return {
    open,
  }
}

export function useContextMenuData () {
  const x = inject(CONTEXT_MENU_X)
  const y = inject(CONTEXT_MENU_Y)
  const items = inject(CONTEXT_MENU_ITEMS)
  const shown = inject(CONTEXT_MENU_SHOWN)
  requireNonnull(x)
  requireNonnull(y)
  requireNonnull(items)
  requireNonnull(shown)
  return {
    x, y, items, shown,
  }
}

export function provideContextMenu () {
  provide(CONTEXT_MENU_ITEMS, ref([]))
  provide(CONTEXT_MENU_X, ref(0))
  provide(CONTEXT_MENU_Y, ref(0))
  provide(CONTEXT_MENU_SHOWN, ref(false))
}
