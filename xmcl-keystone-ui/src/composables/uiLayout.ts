import { injection } from '@/util/inject'
import { InjectionKey } from 'vue'

export function useInFocusMode() {
  return injection(kInFocusMode)
}
/**
 * Represent whether the UI is in focus mode
 */
export const kInFocusMode: InjectionKey<Ref<boolean>> = Symbol('InFocusMode')
