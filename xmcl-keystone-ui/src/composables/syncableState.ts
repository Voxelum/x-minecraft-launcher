import { SharedState } from '@xmcl/runtime-api'
import { useEventListener } from '@vueuse/core'
import { shallowRef, triggerRef } from 'vue'

export type Handler<T> = { [k in keyof T]?: T[k] /* extends (...args: infer A) => infer R ? (state: T, ...args: A) => R : never */ }

export function useState<T extends object>(fetcher: (abortSignal: AbortSignal) => Promise<SharedState<T>> | undefined,
  Type: { prototype: Handler<T>; new(): T }) {
  const isValidating = ref(false)

  // Use shallowRef: the SharedState object is mutated in-place by the preload
  // 'commit' IPC handler (see xmcl-electron-app/preload/service.ts). A deep
  // reactive() wrapper would never observe those mutations because they hit
  // the raw target, not the Vue Proxy. Instead we keep a shallow ref and
  // trigger it manually whenever the state is mutated.
  const state = shallowRef<SharedState<T> | undefined>()
  const error = ref(undefined as any)
  let controller: AbortController | undefined
  const onMutation = (data: any) => (mutation: string, payload: any) => {
    ((Type.prototype as any)?.[mutation] as Function)?.call(data, payload)
    triggerRef(state)
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
    let data: SharedState<T> | undefined
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

      // The preload is a dumb pipe and no longer knows the mutation method
      // names (it used to import the state classes, which pulled zod into every
      // preload bundle). Install the mutation-forwarding methods here from the
      // `Type` we already hold, so renderer calls like `state.value.localeSet(x)`
      // still reach the main process via the generic `commit` channel.
      for (const key of Object.getOwnPropertyNames(Type.prototype)) {
        if (key === 'constructor') continue
        if (typeof (Type.prototype as any)[key] === 'function') {
          (data as any)[key] = (...args: any[]) => (data as any).commit(key, ...args)
        }
      }

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
