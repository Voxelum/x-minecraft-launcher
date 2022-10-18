import { useRouter } from 'vue-router/composables'
import { inject, provide, InjectionKey } from 'vue'
import { useService } from './service'
import { BaseServiceKey } from '@xmcl/runtime-api'

export const kAsyncRouteHandlers: InjectionKey<Array<() => void | Promise<void>>> = Symbol('BEFORE_LEAVE')

export function useAsyncRouteBeforeLeaves() {
  const beforeLeaves = inject(kAsyncRouteHandlers)
  if (!beforeLeaves) throw new Error('MissingRouteBeforeLeave')
  return beforeLeaves
}

export function useAsyncRoute() {
  const funcs = inject(kAsyncRouteHandlers)
  if (!funcs) throw new Error('Illegal State')
  function beforeUnmount(func: () => void | Promise<void>) {
    if (!funcs) throw new Error('Illegal State')
    funcs.push(func)
  }
  return {
    beforeUnmount,
  }
}

export function useExternalRoute() {
  const { openInBrowser } = useService(BaseServiceKey)
  const { beforeEach } = useRouter()
  beforeEach((to, from, next) => {
    const full = to.fullPath.substring(1)
    if (full.startsWith('https:') || full.startsWith('http:') || full.startsWith('external')) {
      next(false)
      console.log(`Prevent ${from.fullPath} -> ${to.fullPath}`)
      if (full.startsWith('external')) {
        console.log(full.substring('external/'.length))
        openInBrowser(full.substring('external/'.length))
      } else {
        openInBrowser(full)
      }
    } else {
      console.log(`Route ${from.fullPath} -> ${to.fullPath}`)
      next()
    }
  })
}
