import { ProjectEntry } from '@/util/search'
import { useSearchPattern } from './useSearchPattern'
import { useModrinthSearchFunc } from './modrinth'
import { SearchModel } from './search'
import { useMarketPageSize } from './marketPageSize'

export function useModrinthSearch<T extends ProjectEntry<any>>(
  projectType: string,
  {
    keyword,
    modLoaders,
    modrinthCategories: categories,
    modrinthSort: sort,
    gameVersion,
    isModrinthDisabled: disabled,
    currentView,
    modrinthEnvironment: environment,
  }: SearchModel
) {
  const { pageSize } = useMarketPageSize()
  const search = useModrinthSearchFunc(
    keyword,
    gameVersion,
    '',
    categories,
    modLoaders,
    environment,
    sort,
    projectType,
    pageSize,
  )

  const {
    error,
    loading,
    result: modrinth,
    onSearch,
    hasMore,
    loadMore,
  } = useSearchPattern(
    async (index, signal) => {
      const result = await search(index, signal)
      return {
        data: result.hits,
        limit: result.limit,
        total: result.total_hits,
        offset: result.offset,
      }
    },
    () => {
      if (disabled.value) {
        return false
      }
      if (currentView.value !== 'remote') {
        return false
      }
      return true
    },
    pageSize,
  )

  function effect() {
    watch(keyword, onSearch)
    watch(categories, onSearch, { deep: true })
    watch(sort, onSearch)
    watch(gameVersion, onSearch)
    watch(disabled, onSearch)
    watch(environment, onSearch)
    watch(pageSize, onSearch)
    onSearch()
  }

  const result = computed(() => {
    const modr = modrinth.value
    if (!modr) return []
    const projects: T[] = markRaw(modr.data.map(i => ({
      id: i.project_id,
      icon: i.icon_url,
      title: i.title,
      author: i.author,
      description: i.description,
      downloadCount: i.downloads,
      followerCount: i.follows,
      modrinth: i,
      installed: [] as any[],
    }) as T))
    return projects
  })

  const modrinthTotal = computed(() => modrinth.value?.total ?? 0)

  return {
    modrinth: result,
    modrinthError: error,
    modrinthTotal,
    hasMore,
    loadMoreModrinth: loadMore,
    effect,
    loadingModrinth: loading,
  }
}
