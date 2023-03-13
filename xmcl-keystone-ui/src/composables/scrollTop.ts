import { InjectionKey, Ref } from 'vue'

export const kCompact: InjectionKey<Ref<boolean>> = Symbol('Compact')

export function useCompactScroll(compact: Ref<boolean>) {
  const onScroll = (e: WheelEvent) => {
    const elem = (e.currentTarget as HTMLElement)
    const value = elem.scrollTop
    compact.value = value > 150
    e.stopPropagation()
  }
  return onScroll
}
