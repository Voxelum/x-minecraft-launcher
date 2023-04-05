import { useRouter } from 'vue-router/composables'

export function useExternalRoute() {
  const router = useRouter()
  router.beforeEach((to, from, next) => {
    const full = to.fullPath.substring(1)
    if (full.startsWith('https:') || full.startsWith('http:')) {
      next(false)
      console.log(`Prevent ${from.fullPath} -> ${to.fullPath}`)
      window.open(full, 'browser')
    } else {
      console.log(`Route ${from.fullPath} -> ${to.fullPath}`)
      next()
    }
  })
}
