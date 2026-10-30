import { get, useDebounceFn } from '@vueuse/core'
import { type MaybeRef, computed, ref } from 'vue'

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
      return false
    }

    loading.value = true
    try {
      error.value = undefined
      const searchResult = await search(offset, signal)
      if (signal.aborted) return false
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
      return true
    } catch (e) {
      if (signal.aborted) return false
      error.value = e
      return false
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
    const nextPage = page.value + 1
    const applied = await executeSearch(nextPage * get(pageSize), true)
    if (applied) {
      page.value = nextPage
    }
  }

  const onSearch = async () => {
    // Invalidate immediately, not 400ms later when the debounce fires.
    abortController?.abort()
    abortController = undefined
    page.value = 0
    error.value = undefined
    loading.value = true
    return debouncedSearch(0, false)
  }

  const hasMore = computed(() => {
    return !!result.value && result.value.total > (result.value.offset + result.value.limit)
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
