import Api, { InjectionKey, provide, Ref, ref } from '@vue/composition-api'
import Vue from 'vue'
import { injection } from '/@/util/inject'

Vue.use(Api)

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

const x = ref(0)
const y = ref(0)
const items = ref([] as ContextMenuItem[])
const shown = ref(false)

export function useContextMenu() {
  const cx = x
  const cy = y
  const citems = items
  const cshown = shown
  const zx = cx
  const zy = cy
  const zitems = citems
  const zshown = cshown
  function open(x: number, y: number, items: ContextMenuItem[]) {
    zx.value = x
    zy.value = y
    zitems.value = items
    zshown.value = true
  }
  return {
    open,
  }
}

export function useContextMenuData() {
  return {
    x, y, items, shown,
  }
}

export function provideContextMenu() {
  provide(CONTEXT_MENU_ITEMS, ref([]))
  provide(CONTEXT_MENU_X, ref(0))
  provide(CONTEXT_MENU_Y, ref(0))
  provide(CONTEXT_MENU_SHOWN, ref(false))
}
