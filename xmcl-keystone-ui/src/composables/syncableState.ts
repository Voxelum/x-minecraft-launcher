import { MutableState } from '@xmcl/runtime-api'
import { useEventListener } from '@vueuse/core'

export type Handler<T> = { [k in keyof T]?: T[k] /* extends (...args: infer A) => infer R ? (state: T, ...args: A) => R : never */ }

export function useState<T extends object>(fetcher: (abortSignal: AbortSignal) => Promise<MutableState<T>> | undefined,
  Type: { prototype: Handler<T>; new(): T }) {
  const isValidating = ref(false)

  const state = ref<MutableState<T> | undefined>()
  const error = ref(undefined as any)
  let controller: AbortController | undefined
  const onMutation = (state: any) => (mutation: string, payload: any) => {
    ((Type.prototype as any)?.[mutation] as Function)?.call(state, payload)
  }
  const onStateValidating = (data: any) => (v: number) => {
    if (data === state.value) {
      isValidating.value = v > 0
    }
  }

  const mutate = async (onCleanup?: (abort: () => void) => void) => {
    controller?.abort()
    const abortController = new AbortController()
    controller = abortController
    const { signal } = abortController
    let data: MutableState<T> | undefined
    onCleanup?.(() => {
      abortController.abort()
    })

    // Avoid calling dispose multiple times
    try {
      isValidating.value = true
      error.value = undefined
      state.value = undefined
      data = await fetcher(signal)
      if (!data || signal.aborted) { return }

      const func = onMutation(data)
      data.subscribeAll(func)

      const validFunc = onStateValidating(data)
      // @ts-ignore
      data.subscribe('state-validating', validFunc)

      abortController.signal.addEventListener('abort', () => {
        data?.unsubscribeAll(func)
        // @ts-ignore
        data?.unsubscribe('state-validating', validFunc)
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
  const revalidateCall = async () => {
    if (isValidating.value) return
    await state.value?.revalidate()
  }
  useEventListener(document, 'visibilitychange', revalidateCall, false)
  useEventListener(window, 'focus', revalidateCall, false)
  return {
    isValidating,
    state,
    error,
    revalidate: revalidateCall,
  }
}
