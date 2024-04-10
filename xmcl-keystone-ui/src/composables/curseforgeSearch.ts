import { clientCurseforgeV1 } from '@/util/clients'
import { getCursforgeModLoadersFromString } from '@/util/curseforge'
import { Mod as CFMod, ModsSearchSortField, Pagination, FileModLoaderType } from '@xmcl/curseforge'
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

export function useCurseforgeSearch<T extends ProjectEntry<any>>(classId: number,
  keyword: Ref<string>,
  modLoaderFilters: Ref<ModLoaderFilter[]>,
  curseforgeCategory: Ref<number | undefined>,
  sort: Ref<ModsSearchSortField | undefined>,
  gameVersion: Ref<string>) {
  const curseforge = ref(undefined as {
    data: CFMod[]
    pagination: Pagination
  } | undefined)

  const processCurseforge = debounce(async (offset: number, append: boolean) => {
    if (keyword.value || curseforgeCategory.value) {
      try {
        curseforgeError.value = undefined
        const modLoaderTypes = getCursforgeModLoadersFromString(modLoaderFilters.value)
        let modLoaderType = undefined as FileModLoaderType | undefined
        if (modLoaderTypes.length === 1) {
          if (modLoaderTypes[0] === 'Forge') modLoaderType = FileModLoaderType.Forge
          if (modLoaderTypes[0] === 'Fabric') modLoaderType = FileModLoaderType.Fabric
          if (modLoaderTypes[0] === 'Quilt') modLoaderType = FileModLoaderType.Quilt
        }
        const result = await clientCurseforgeV1.searchMods({
          classId,
          sortField: sort.value,
          modLoaderTypes: modLoaderTypes.length > 1 ? modLoaderTypes : undefined,
          modLoaderType,
          gameVersion: gameVersion.value,
          searchFilter: keyword.value,
          categoryId: curseforgeCategory.value,
          pageSize: 20,
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
  }, 1000)

  const curseforgeError = ref(undefined as any)
  const loadingCurseforge = ref(false)
  const curseforgePage = ref(0)
  const canCurseforgeLoadMore = computed(() => {
    return curseforge.value && curseforge.value.pagination.totalCount > (curseforge.value.pagination.index + curseforge.value.pagination.resultCount)
  })

  const loadMoreCurseforge = async () => {
    if (!curseforge.value) return
    const hasMore = curseforge.value.pagination.totalCount > (curseforge.value.pagination.index + curseforge.value.pagination.resultCount)
    if (!hasMore) return
    curseforgePage.value += 1
    loadingCurseforge.value = true
    await processCurseforge(curseforgePage.value * 20, true)
  }

  const onSearch = async () => {
    loadingCurseforge.value = true
    curseforgePage.value = 0
    processCurseforge(curseforgePage.value * 20, false)
  }

  watch(keyword, onSearch)
  watch(modLoaderFilters, onSearch, { deep: true })
  watch(curseforgeCategory, onSearch, { deep: true })
  watch(sort, onSearch)

  const mods = computed(() => {
    const cf = curseforge.value
    if (!cf) return []
    const mods: T[] = cf.data.map(i => markRaw({
      id: i.id.toString(),
      icon: i.logo?.url ?? '',
      title: i.name,
      author: i.authors[0]?.name,
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
