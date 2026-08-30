import { computed, shallowRef, type Ref } from 'vue'

export function useInstanceLoading(instancePath: Readonly<Ref<string>>) {
  const operations = shallowRef<Record<string, number>>({})
  const isLoading = computed(() => (operations.value[instancePath.value] ?? 0) > 0)

  function begin(path: string) {
    if (!path) return () => {}
    operations.value = {
      ...operations.value,
      [path]: (operations.value[path] ?? 0) + 1,
    }
    let ended = false
    return () => {
      if (ended) return
      ended = true
      const next = { ...operations.value }
      const count = (next[path] ?? 1) - 1
      if (count > 0) {
        next[path] = count
      } else {
        delete next[path]
      }
      operations.value = next
    }
  }

  return { begin, isLoading }
}