import { Ref, ref } from 'vue'

export interface ContextMenuItem {
  text: string
  icon: string
  color?: string
  onClick: () => void
}

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
