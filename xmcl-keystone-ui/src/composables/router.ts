import VueRouter from 'vue-router'
import { useRouter } from 'vue-router/composables'

export function useExternalRoute(router: VueRouter) {
  router.beforeEach((to, from, next) => {
    const full = to.fullPath.substring(1)
    if (full.startsWith('https:') || full.startsWith('http:')) {
      next(false)
      window.open(full, 'browser')
    } else {
      next()
    }
  })
}
