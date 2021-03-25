import VueRouter from 'vue-router'
import { inject, provide, InjectionKey } from '@vue/composition-api'
import { ROUTER_KEY } from '/@/constant'

export function useRouter (): VueRouter {
  const router = inject(ROUTER_KEY)
  if (!router) throw new Error('Cannot find router. Maybe router not loaded?')
  return router
}

export const BEFORE_LEAVE: InjectionKey<Array<() => void | Promise<void>>> = Symbol('BEFORE_LEAVE')

export function provideAsyncRoute () {
  provide(BEFORE_LEAVE, [])
}

export function useAsyncRouteBeforeLeaves () {
  const beforeLeaves = inject(BEFORE_LEAVE)
  if (!beforeLeaves) throw new Error('MissingRouteBeforeLeave')
  return beforeLeaves
}

export function useAsyncRoute () {
  const funcs = inject(BEFORE_LEAVE)
  if (!funcs) throw new Error('Illegal State')
  function beforeUnmount (func: () => void | Promise<void>) {
    if (!funcs) throw new Error('Illegal State')
    funcs.push(func)
  }
  return {
    beforeUnmount,
  }
}

export function provideRouterHistory () {
  const localHistory: string[] = []
  const router = useRouter()
  const beforeLeaves = useAsyncRouteBeforeLeaves()

  let timeTraveling = false
  router.afterEach((to, from) => {
    if (!timeTraveling) localHistory.push(from.fullPath)
  })
  async function goBack () {
    timeTraveling = true
    const before = localHistory.pop()
    if (before) {
      for (let hook = beforeLeaves.pop(); hook; hook = beforeLeaves.pop()) {
        const result = hook()
        if (result instanceof Promise) {
          await result
        }
      }
      router.replace(before)
    }
    timeTraveling = false
  }

  provide('history', localHistory)

  return {
    goBack,
  }
}

export function useRouterHistory () {
  return inject('history', [] as string[])
}
