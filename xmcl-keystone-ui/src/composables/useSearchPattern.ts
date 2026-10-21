import { get, useDebounceFn } from '@vueuse/core'
import type { MaybeRef } from 'vue'

export function useSearchPattern<T>(search: (offset: number, signal: AbortSignal) => Promise<{
  data: T[]
  total: number
  offset: number
  limit: number
}>, shouldSearch: () => boolean, pageSize: MaybeRef<number> = 20) {
  const result = ref(undefined as undefined | {
    data: T[]
    total: number
    offset: number
    limit: number
  })
  const page = ref(0)
  const loading = ref(false)
  const error = ref(undefined as any)

  let abortController: AbortController | undefined

  const executeSearch = async (offset: number, append: boolean) => {
    // Cancel any in-flight request so its (possibly out-of-order) response
    // cannot overwrite the result of this newer search.
    abortController?.abort()
    const controller = new AbortController()
    abortController = controller
    const { signal } = controller

    if (!shouldSearch()) {
      error.value = undefined
      loading.value = false
      result.value = undefined
      return
    }

    loading.value = true
    try {
      error.value = undefined
      const searchResult = await search(offset, signal)
      if (signal.aborted) return
      if (!append || !result.value) {
        result.value = searchResult as any
      } else {
        result.value = {
          data: [...result.value.data, ...searchResult.data as any],
          total: searchResult.total,
          offset: searchResult.offset,
          limit: searchResult.limit,
        }
      }
    } catch (e) {
      if (signal.aborted) return
      error.value = e
    } finally {
      if (abortController === controller) {
        loading.value = false
      }
    }
  }

  const debouncedSearch = useDebounceFn(async (offset: number, append: boolean) => {
    return executeSearch(offset, append)
  }, 400)

  const loadMore = async () => {
    if (!result.value) return
    if (!hasMore.value) return
    if (loading.value) return
    page.value += 1
    await executeSearch(page.value * get(pageSize), true)
  }

  const onSearch = async () => {
    page.value = 0
    error.value = undefined
    loading.value = true
    return debouncedSearch(0, false)
  }

  const hasMore = computed(() => {
    return !!result.value && result.value.data.length < result.value.total
  })

  return {
    result,
    page,
    loadMore,
    loading,
    onSearch,
    hasMore,
    error,
  }
}
