export function useBeforeLeave(hook: () => boolean) {
  const router = useRouter()
  let remove = () => { }
  onMounted(() => {
    remove = router.beforeEach((to, from, next) => {
      if (hook()) {
        next()
      } else {
        next(false)
      }
    })
  })
  onUnmounted(() => {
    remove()
  })
}
