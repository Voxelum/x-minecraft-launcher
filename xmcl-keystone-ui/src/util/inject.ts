import { inject, InjectionKey } from 'vue'

export function injection<T>(key: InjectionKey<T>) {
  const result = inject(key)
  if (!result) throw new Error(`Cannot find ${key} to inject`)
  return result
}
