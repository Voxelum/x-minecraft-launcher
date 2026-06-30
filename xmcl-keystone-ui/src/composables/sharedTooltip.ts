import { useDebounceFn } from '@vueuse/core'

const isShown = ref(false)
const stack = shallowRef([] as SharedTooltipData[])
const blocked = ref(false)
const pending = [undefined as boolean | undefined]
const _setValue = useDebounceFn(() => {
  if (pending[0] === undefined) return
  isShown.value = pending[0]
  pending[0] = undefined
}, 100)
const setValue = (v: boolean) => {
  pending[0] = v
  _setValue()
}

export interface SharedTooltipData {
  text: string
  direction: 'top' | 'bottom' | 'left' | 'right'
  x: number
  y: number
  color: string
  items: Array<{ text: string; icon: string }> | undefined
  list: Array<string> | undefined
  el: WeakRef<HTMLElement> | undefined
}

/**
 * Drop entries whose owning element has been garbage-collected or detached
 * from the DOM. Without this prune, the v-shared-tooltip directive can leave
 * "zombie" entries on the stack — once they bubble to the top the tooltip
 * stays visible even though the user is no longer hovering anything.
 */
export function pruneTooltipStack() {
  const next: SharedTooltipData[] = []
  let changed = false
  for (const item of stack.value) {
    const el = item.el?.deref()
    if (el && el.isConnected) {
      next.push(item)
    } else {
      changed = true
    }
  }
  if (changed) {
    stack.value = next
  }
  return next
}

export function useSharedTooltipData() {
  return {
    isShown,
    stack,
    setValue,
    blocked,
    pruneStack: pruneTooltipStack,
  }
}

export function useBlockSharedTooltip() {
  const start = () => {
    blocked.value = true
    isShown.value = false
    stack.value = []
  }
  const end = () => {
    blocked.value = false
    isShown.value = false
    stack.value = []
  }
  return {
    start,
    end,
  }
}

