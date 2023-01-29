import { InjectionKey } from 'vue'

export function useSharedTooltip<T>(getTooltip: (v: T) => string) {
  const currentTooltip = ref('')
  const x = ref(0)
  const y = ref(0)
  const color = ref('black')
  const isShown = ref(false)
  const onEnter = async (e: MouseEvent, val: T) => {
    const target = e.target as HTMLElement
    const rect = target.getBoundingClientRect()
    x.value = rect.x + rect.width / 2
    y.value = rect.y - 0
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
