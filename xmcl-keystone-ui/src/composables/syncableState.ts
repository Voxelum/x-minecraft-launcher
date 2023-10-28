import { MutableState } from '@xmcl/runtime-api'

export type Handler<T> = { [k in keyof T]?: T[k] /* extends (...args: infer A) => infer R ? (state: T, ...args: A) => R : never */ }

export function useState<T extends object>(fetcher: (abortSignal: AbortSignal) => Promise<MutableState<T>> | undefined,
  Type: { prototype: Handler<T>; new(): T }) {
  const isValidating = ref(false)

  const state = ref<T | undefined>()
  const error = ref(undefined as any)
  const mutate = async (onCleanup?: (abort: () => void) => void) => {
    const abortController = new AbortController()
    const { signal } = abortController
    let data: MutableState<T> | undefined
    onCleanup?.(() => {
      abortController.abort()
    })

    // Avoid calling dispose multiple times
    try {
      isValidating.value = true
      error.value = undefined
      data = await fetcher(signal)
      if (!data || signal.aborted) { return }
      data.subscribeAll((mutation, payload) => {
        ((Type.prototype as any)?.[mutation] as Function)?.call(state.value, payload)
      })
      state.value = data
    } catch (e) {
      if (signal.aborted) { return }
      error.value = e
      state.value = undefined
      if (import.meta.env.DEV) console.error(e)
    } finally {
      isValidating.value = false
    }
  }
  watchEffect(mutate)
  return {
    isValidating,
    state,
    error,
  }
}
