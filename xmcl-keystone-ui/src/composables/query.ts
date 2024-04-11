import { MaybeRef, get } from '@vueuse/core'
import { Ref } from 'vue'

export function useQuery(key: string) {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get() { return route.query[key] as string ?? '' },
    set(v) { if (route.query[key] !== v) router.replace({ path: route.path, query: { ...route.query, [key]: v } }) },
  })
}

export function useQueryStringArray<T extends string>(key: string) {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get() { return route.query[key] ? (route.query[key] as string).split(',') as T[] : [] },
    set(v) { if (v && route.query[key] !== v.join(',')) router.replace({ path: route.path, query: { ...route.query, [key]: v.join(',') } }) },
  })
}

export function useQueryNumber<T extends number | undefined>(key: string, defaultValue: T) {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get() { return route.query[key] ? Number(route.query[key] as string) : defaultValue },
    set(v) { if (route.query[key] !== v?.toString() ?? '') router.replace({ path: route.path, query: { ...route.query, [key]: v?.toString() ?? '' } }) },
  })
}

export function useQueryBoolean(key: string, defaultValue = false) {
  const route = useRoute()
  const router = useRouter()
  return computed({
    get() { return !route.query[key] ? defaultValue : route.query[key] === 'true' },
    set(v) { if (route.query[key] !== v.toString()) router.replace({ path: route.path, query: { ...route.query, [key]: v.toString() } }) },
  })
}

export const searlizers = {
  string: {
    fromString: (v: string) => v,
    toString: (v: string) => v,
  },
  number: {
    fromString: (v: string) => v ? Number(v) : undefined,
    toString: (v: number | undefined) => v ? v.toString() : '',
  },
  boolean: {
    fromString: (v: string) => v === 'true',
    toString: (v: boolean) => v.toString(),
  },
  stringArray: {
    fromString: (v: string) => v.split(',') as string[],
    toString: (v: string[]) => v.join(','),
  },
}

export function useQueryOverride<T>(key: string, refValue: Ref<T>, defaultValue: MaybeRef<T>, { fromString, toString }: { fromString: (v: string) => T; toString: (v: T) => string }) {
  const route = useRoute()
  const router = useRouter()

  if (key in route.query) {
    const sVal = toString(refValue.value)
    if (route.query[key] !== sVal) {
      const v = route.query[key]
      refValue.value = typeof v === 'string' ? fromString(v) : get(defaultValue)
    }
  } else {
    refValue.value = get(defaultValue)
  }

  watch(computed(() => route.query[key]), (queryVal) => {
    const sVal = toString(refValue.value)
    if (queryVal !== sVal) {
      refValue.value = typeof queryVal === 'string' ? fromString(queryVal) : get(defaultValue)
    }
  })

  watch(refValue, (val) => {
    const sVal = toString(val)
    if (route.query[key] !== sVal) {
      router.replace({ path: route.path, query: { ...route.query, [key]: sVal } })
    }
  })
}
