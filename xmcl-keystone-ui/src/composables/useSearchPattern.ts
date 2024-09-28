import debounce from 'lodash.debounce'

export function useSearchPattern<T>(search: (offset: number) => Promise<{
  data: T[]
  total: number
  offset: number
  limit: number
}>, shouldSearch: () => boolean) {
  const result = ref(undefined as undefined | {
    data: T[]
    total: number
    offset: number
    limit: number
  })
  const page = ref(0)
  const loading = ref(false)
  const error = ref(undefined as any)

  const doSearch = debounce(async (offset: number, append: boolean) => {
    if (!shouldSearch()) {
      error.value = undefined
      loading.value = false
      result.value = undefined
      return
    }
    try {
      error.value = undefined
      const searchResult = await search(offset)
      if (!append || !result.value) {
        result.value = searchResult as any
      } else {
        result.value.data.push(...searchResult.data as any)
        result.value.total = searchResult.total
        result.value.offset = searchResult.offset
        result.value.limit = searchResult.limit
      }
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }, 500)

  const loadMore = async () => {
    if (!result.value) return
    if (!hasMore.value) return
    page.value += 1
    loading.value = true
    await doSearch(page.value * 20, true)
  }

  const onSearch = async () => {
    loading.value = true
    page.value = 0
    error.value = undefined
    return doSearch(page.value * 20, false)
  }

  const hasMore = computed(() => {
    return result.value && result.value.total > (result.value.offset + result.value.limit)
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
