import VueRouter from 'vue-router'
import { inject, provide, InjectionKey } from '@vue/composition-api'
import { ROUTER_KEY } from '/@/constant'

export function useRouter(): VueRouter {
  const router = inject(ROUTER_KEY)
  if (!router) throw new Error('Cannot find router. Maybe router not loaded?')
  return router
}

export const BEFORE_LEAVE: InjectionKey<Array<() => void | Promise<void>>> = Symbol('BEFORE_LEAVE')

export function provideAsyncRoute() {
  provide(BEFORE_LEAVE, [])
}

export function useAsyncRouteBeforeLeaves() {
  const beforeLeaves = inject(BEFORE_LEAVE)
  if (!beforeLeaves) throw new Error('MissingRouteBeforeLeave')
  return beforeLeaves
}

export function useAsyncRoute() {
  const funcs = inject(BEFORE_LEAVE)
  if (!funcs) throw new Error('Illegal State')
  function beforeUnmount(func: () => void | Promise<void>) {
    if (!funcs) throw new Error('Illegal State')
    funcs.push(func)
  }
  return {
    beforeUnmount,
  }
}
