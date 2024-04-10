export function useQuery(key: string) {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get() { return route.query[key] as string ?? '' },
    set(v) { router.replace({ path: route.path, query: { ...route.query, [key]: v } }) },
  })
}

export function useQueryStringArray(key: string) {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get() { return (route.query[key] as string ?? '').split(',') },
    set(v) { router.replace({ path: route.path, query: { ...route.query, [key]: v.join(',') } }) },
  })
}

export function useQueryNumber(key: string, defaultValue = 0) {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get() { return Number(route.query[key] as string ?? defaultValue) },
    set(v) { router.replace({ path: route.path, query: { ...route.query, [key]: v.toString() } }) },
  })
}

export function useQueryBoolean(key: string, defaultValue = false) {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get() { return !route.query[key] ? defaultValue : route.query[key] === 'true' },
    set(v) { router.replace({ path: route.path, query: { ...route.query, [key]: v.toString() } }) },
  })
}
