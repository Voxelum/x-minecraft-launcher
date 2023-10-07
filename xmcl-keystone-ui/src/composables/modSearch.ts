import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCurseforgeModLoaderTypeFromRuntime, getCursforgeModLoadersFromString } from '@/util/curseforge'
import { isNoModLoader } from '@/util/isNoModloader'
import { ModFile, getModFileFromResource } from '@/util/mod'
import { getModrinthModLoaders } from '@/util/modrinth'
import { Mod as CFMod, FileModLoaderType, ModsSearchSortField, Pagination } from '@xmcl/curseforge'
import { SearchResult } from '@xmcl/modrinth'
import { InstanceData, Resource } from '@xmcl/runtime-api'
import { filter } from 'fuzzy'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref } from 'vue'

export const kModsSearch: InjectionKey<ReturnType<typeof useModsSearch>> = Symbol('ModsSearch')

export enum ModLoaderFilter {
  fabric = 'fabric',
  forge = 'forge',
  quilt = 'quilt',
}

export function useModsSearch(resources: Ref<Resource[]>, runtime: Ref<InstanceData['runtime']>, instanceMods: Ref<ModFile[]>) {
  const modLoaderFilters = ref([] as ModLoaderFilter[])
  const keyword: Ref<string> = ref('')

  watch(runtime, (version) => {
    const items = [] as ModLoaderFilter[]
    if (isNoModLoader(version)) {
      items.push(ModLoaderFilter.fabric, ModLoaderFilter.forge, ModLoaderFilter.quilt)
    } else {
      if (version.fabricLoader) {
        items.push(ModLoaderFilter.fabric)
      }
      if (version.forge || version.neoForged) {
        items.push(ModLoaderFilter.forge)
      }
      if (version.quiltLoader) {
        items.push(ModLoaderFilter.quilt, ModLoaderFilter.fabric)
      }
    }

    modLoaderFilters.value = items
  }, { immediate: true, deep: true })

  const useForge = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.forge) !== -1)
  const useFabric = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.fabric) !== -1)
  const useQuilt = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.quilt) !== -1)

  const isValidResource = (r: Resource) => {
    if (useForge.value) return !!r.metadata.forge
    if (useFabric.value) return !!r.metadata.fabric
    if (useQuilt.value) return !!r.metadata.quilt
    return false
  }

  const mods = computed(() => keyword.value
    ? filter(keyword.value, resources.value, {
      extract: (r) => `${r.name} ${r.fileName}`,
    }).map((r) => r.original ? r.original : r as any as Resource)
      .filter(isValidResource).map(r => getModFileFromResource(r, runtime.value))
    : resources.value.filter(isValidResource).map(r => getModFileFromResource(r, runtime.value)))

  const existedMods = computed(() =>
    keyword.value.length === 0
      ? instanceMods.value
      : instanceMods.value.filter(m => m.name.toLocaleLowerCase().indexOf(keyword.value.toLocaleLowerCase()) !== -1),
  )

  const modrinth = ref(undefined as SearchResult | undefined)
  const curseforge = ref(undefined as {
    data: CFMod[]
    pagination: Pagination
  } | undefined)

  const processModrinth = async (offset: number, append: boolean) => {
    try {
      modrinthError.value = undefined
      const facets = [`["versions:${runtime.value.minecraft}"]`, '["project_type:mod"]']
      facets.push('[' + modLoaderFilters.value.map(m => `"categories:${m}"`).join(', ') + ']')
      if (keyword.value) {
        const remain = append && modrinth.value ? modrinth.value.total_hits - offset : Number.MAX_SAFE_INTEGER
        const result = await clientModrinthV2.searchProjects({
          query: keyword.value,
          facets: '[' + facets.join(',') + ']',
          index: 'relevance',
          offset,
          limit: append ? Math.min(remain, 20) : 20,
        })
        if (!append || !modrinth.value) {
          modrinth.value = result
        } else {
          modrinth.value.hits.push(...result.hits)
          modrinth.value.limit += result.limit
          modrinth.value.offset = result.offset
        }
      } else {
        modrinth.value = undefined
      }
    } catch (e) {
      modrinthError.value = e
    } finally {
      loadingModrinth.value = false
    }
  }

  const processCurseforge = async (offset: number, append: boolean) => {
    if (keyword.value) {
      try {
        curseforgeError.value = undefined
        const remain = append && curseforge.value ? curseforge.value.pagination.totalCount - offset : Number.MAX_SAFE_INTEGER
        const result = await clientCurseforgeV1.searchMods({
          classId: 6, // mods
          sortField: ModsSearchSortField.Name,
          modLoaderTypes: getCursforgeModLoadersFromString(modLoaderFilters.value),
          gameVersion: runtime.value.minecraft,
          searchFilter: keyword.value,
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

  const modrinthError = ref(undefined as any)
  const loadingModrinth = ref(false)
  const curseforgeError = ref(undefined as any)
  const loadingCurseforge = ref(false)
  const loading = computed(() => loadingModrinth.value || loadingCurseforge.value)
  const modrinthPage = ref(0)
  const curseforgePage = ref(0)
  const canCurseforgeLoadMore = computed(() => {
    return curseforge.value && curseforge.value.pagination.totalCount > (curseforge.value.pagination.index + curseforge.value.pagination.resultCount)
  })
  const canModrinthLoadMore = computed(() => {
    return modrinth.value && modrinth.value.total_hits > (modrinth.value.offset + modrinth.value.limit)
  })

  const loadMoreCurseforge = debounce(async () => {
    if (canCurseforgeLoadMore.value) {
      curseforgePage.value += 1
      loadingCurseforge.value = true
      await processCurseforge(curseforgePage.value * 20, true)
    }
  }, 1000)
  const loadMoreModrinth = debounce(async () => {
    if (canModrinthLoadMore.value) {
      modrinthPage.value += 1
      loadingModrinth.value = true
      await processModrinth(modrinthPage.value * 20, true)
    }
  }, 1000)

  const onSearch = async () => {
    loadingModrinth.value = true
    loadingCurseforge.value = true
    modrinthPage.value = 0
    curseforgePage.value = 0
    processModrinth(modrinthPage.value * 20, false)
    processCurseforge(curseforgePage.value * 20, false)
  }

  watch(keyword, onSearch)

  return {
    modLoaderFilters,
    loadMoreCurseforge,
    loadMoreModrinth,
    canCurseforgeLoadMore,
    canModrinthLoadMore,
    modrinthError,
    loadingModrinth,
    curseforgeError,
    loadingCurseforge,
    mods,
    existedMods,
    modrinth,
    curseforge,
    keyword,
    loading,
  }
}
