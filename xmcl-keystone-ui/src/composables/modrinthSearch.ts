import { ProjectEntry } from '@/util/search'
import { Ref } from 'vue'
import { useSearchPattern } from './useSearchPattern'
import { useModrinthSearchFunc } from './modrinth'

export function useModrinthSearch<T extends ProjectEntry<any>>(
  projectType: string,
  keyword: Ref<string>,
  loaders: Ref<string[]>,
  categories: Ref<string[]>,
  sort: Ref<'relevance' | 'downloads' | 'follows' | 'newest' | 'updated' | undefined>,
  gameVersion: Ref<string>,
) {
  const search = useModrinthSearchFunc(
    keyword,
    gameVersion,
    '',
    categories,
    loaders,
    '',
    sort,
    projectType,
    20,
  )

  const {
    error,
    loading,
    result: modrinth,
    onSearch,
    hasMore,
    loadMore,
  } = useSearchPattern(
    async (index) => {
      const result = await search(index)
      return {
        data: result.hits,
        limit: result.limit,
        total: result.total_hits,
        offset: result.offset,
      }
    },
    () => {
      if (keyword.value) {
        return true
      }
      if (categories.value.length > 0) {
        return true
      }
      return false
    },
  )

  function effect() {
    watch(keyword, onSearch)
    watch(categories, onSearch, { deep: true })
    watch(sort, onSearch)
    watch(gameVersion, onSearch)
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

  return {
    modrinth: result,
    modrinthError: error,
    hasMore,
    loadMoreModrinth: loadMore,
    effect,
    loadingModrinth: loading,
  }
}
