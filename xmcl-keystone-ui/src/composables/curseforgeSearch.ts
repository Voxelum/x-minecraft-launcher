import { getCursforgeModLoadersFromString } from '@/util/curseforge'
import { ProjectEntry } from '@/util/search'
import { Mod as CurseforgeMod, ModsSearchSortField } from '@xmcl/curseforge'
import { Ref } from 'vue'
import { useCurseforgeSearchFunc } from './curseforge'
import { ModLoaderFilter } from './modSearch'
import { useSearchPattern } from './useSearchPattern'

function getProjectFileFromCurseforge<T extends ProjectEntry>(i: CurseforgeMod) {
  return {
    id: i.id.toString(),
    icon: i.logo?.url ?? '',
    title: i.name,
    author: i.authors[0]?.name,
    description: i.summary,
    downloadCount: i.downloadCount,
    followerCount: i.thumbsUpCount,
    curseforge: i,
    installed: [] as any[],
  } as T
}

export function useCurseforgeSearch<T extends ProjectEntry<any>>(
  classId: number,
  keyword: Ref<string>,
  modLoaderFilters: Ref<ModLoaderFilter[]>,
  curseforgeCategory: Ref<number | undefined>,
  sort: Ref<ModsSearchSortField | undefined>,
  gameVersion: Ref<string>,
) {
  const search = useCurseforgeSearchFunc(
    classId,
    keyword,
    computed(() => getCursforgeModLoadersFromString(modLoaderFilters.value)),
    curseforgeCategory,
    sort,
    gameVersion,
    20,
  )

  const { error, loadMore, loading, onSearch, hasMore, result } = useSearchPattern(async (offset) => {
    const result = await search(offset)
    return {
      data: result.data,
      total: result.pagination.totalCount,
      offset: result.pagination.index,
      limit: result.pagination.resultCount,
    }
  }, () => {
    if (keyword.value) {
      return true
    }
    if (curseforgeCategory.value) {
      return true
    }
    return false
  })

  function effect() {
    watch(keyword, onSearch)
    watch(modLoaderFilters, onSearch, { deep: true })
    watch(curseforgeCategory, onSearch, { deep: true })
    watch(sort, onSearch)
    watch(gameVersion, onSearch)
  }

  const mods = computed(() => {
    const cf = result.value
    if (!cf) return []
    const mods = cf.data.map(i => markRaw(getProjectFileFromCurseforge<T>(i)))
    return mods as T[]
  })

  return {
    curseforge: mods,
    curseforgeError: error,
    loadMoreCurseforge: loadMore,
    loadingCurseforge: loading,
    canCurseforgeLoadMore: hasMore,
    effect,
  }
}
