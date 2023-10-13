import { InjectionKey } from 'vue'

const currentTooltip = ref('')
const x = ref(0)
const y = ref(0)
const color = ref('black')
const isShown = ref(false)
const left = ref(false)
const stack = [] as [number, number, string, string, boolean][]

export function useSharedTooltipData() {
  return {
    currentTooltip,
    left,
    x,
    y,
    color,
    isShown,
    stack,
  }
}
export function useSharedTooltip<T>(getTooltip: (v: T) => string) {
  const onEnter = async (e: MouseEvent, val: T) => {
    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    if (!left.value) {
      x.value = rect.x + rect.width / 2
      y.value = rect.y - 0
    } else {
      x.value = rect.x
      y.value = rect.y + rect.width / 2
    }
    currentTooltip.value = getTooltip(val)
    isShown.value = true
  }
  const onLeave = async (e: MouseEvent) => {
    isShown.value = false
  }
  return {
    currentTooltip,
    x,
    y,
    color,
    isShown,
    onEnter,
    onLeave,
  }
}

export const kSharedTooltip: InjectionKey<ReturnType<typeof useSharedTooltip>> = Symbol('SharedTooltip')
