import { clientCurseforgeV1 } from '@/util/clients'
import { getCursforgeModLoadersFromString } from '@/util/curseforge'
import { Mod as CFMod, ModsSearchSortField, Pagination } from '@xmcl/curseforge'
import { InstanceData } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { Ref } from 'vue'
import { ModLoaderFilter } from './modSearch'
import { ProjectEntry } from '@/util/search'

export enum CurseforgeBuiltinClassId {
  mod = 6,
  modpack = 4471,
  resourcePack = 12,
  world = 17,
}

export function useCurseforgeSearch<T extends ProjectEntry<any>>(classId: number, keyword: Ref<string>, modLoaderFilters: Ref<ModLoaderFilter[]>, curseforgeCategory: Ref<number | undefined>, runtime: Ref<InstanceData['runtime']>) {
  const curseforge = ref(undefined as {
    data: CFMod[]
    pagination: Pagination
  } | undefined)

  const processCurseforge = async (offset: number, append: boolean) => {
    if (keyword.value || curseforgeCategory.value) {
      try {
        curseforgeError.value = undefined
        const remain = append && curseforge.value ? curseforge.value.pagination.totalCount - offset : Number.MAX_SAFE_INTEGER
        const result = await clientCurseforgeV1.searchMods({
          classId,
          sortField: keyword.value ? ModsSearchSortField.Name : ModsSearchSortField.Popularity,
          modLoaderTypes: getCursforgeModLoadersFromString(modLoaderFilters.value),
          gameVersion: runtime.value.minecraft,
          searchFilter: keyword.value,
          categoryId: curseforgeCategory.value,
          pageSize: append ? Math.min(20, remain) : 20,
          index: offset,
        })

        if (!append || !curseforge.value) {
          curseforge.value = result
        } else {
          curseforge.value.data.push(...result.data)
          curseforge.value.pagination = result.pagination
        }
      } catch (e) {
        curseforgeError.value = e
      } finally {
        loadingCurseforge.value = false
      }
    } else {
      curseforgeError.value = undefined
      loadingCurseforge.value = false
      curseforge.value = undefined
    }
  }

  const curseforgeError = ref(undefined as any)
  const loadingCurseforge = ref(false)
  const curseforgePage = ref(0)
  const canCurseforgeLoadMore = computed(() => {
    return curseforge.value && curseforge.value.pagination.totalCount > (curseforge.value.pagination.index + curseforge.value.pagination.resultCount)
  })

  const loadMoreCurseforge = debounce(async () => {
    if (canCurseforgeLoadMore.value) {
      curseforgePage.value += 1
      loadingCurseforge.value = true
      await processCurseforge(curseforgePage.value * 20, true)
    }
  }, 1000)

  const onSearch = async () => {
    loadingCurseforge.value = true
    curseforgePage.value = 0
    processCurseforge(curseforgePage.value * 20, false)
  }

  watch(keyword, onSearch)
  watch(modLoaderFilters, onSearch)
  watch(curseforgeCategory, onSearch)

  const mods = computed(() => {
    const cf = curseforge.value
    if (!cf) return []
    const mods: T[] = cf.data.map(i => markRaw({
      id: i.id.toString(),
      icon: i.logo?.url ?? '',
      title: i.name,
      author: i.authors[0].name,
      description: i.summary,
      downloadCount: i.downloadCount,
      followerCount: i.thumbsUpCount,
      curseforge: i,
      installed: [] as any[],
    }) as any)
    return mods
  })

  return {
    curseforge: mods,
    curseforgeError,
    loadMoreCurseforge,
    loadingCurseforge,
    canCurseforgeLoadMore,
  }
}
