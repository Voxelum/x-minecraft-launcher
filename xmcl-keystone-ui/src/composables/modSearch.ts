import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { Mod, getModItemFromResource } from '@/util/mod'
import { Mod as CFMod, FileModLoaderType, ModsSearchSortField, Pagination } from '@xmcl/curseforge'
import { SearchResult } from '@xmcl/modrinth'
import { InstanceData, Resource } from '@xmcl/runtime-api'
import { filter } from 'fuzzy'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref } from 'vue'

export const kModsSearch: InjectionKey<ReturnType<typeof useModsSearch>> = Symbol('ModsSearch')

export function useModsSearch(keyword: Ref<string>, resources: Ref<Resource[]>, runtime: Ref<InstanceData['runtime']>, instanceMods: Ref<Mod[]>) {
  const isValidResource = (r: Resource) => {
    const useForge = !!runtime.value.forge
    const useFabric = !!runtime.value.fabricLoader
    const useQuilt = !!runtime.value.quiltLoader
    if (useForge) return !!r.metadata.forge
    if (useFabric) return !!r.metadata.fabric
    if (useQuilt) return !!r.metadata.quilt
    return false
  }

  const mods = computed(() => keyword.value
    ? filter(keyword.value, resources.value, {
      extract: (r) => `${r.name} ${r.fileName}`,
    }).map((r) => r.original ? r.original : r as any as Resource)
      .filter(isValidResource).map(getModItemFromResource)
    : resources.value.filter(isValidResource).map(getModItemFromResource))

  const existedMods = computed(() =>
    keyword.value.length === 0
      ? instanceMods.value.filter(v => isValidResource(v.resource))
      : instanceMods.value.filter(m => m.name.toLocaleLowerCase().indexOf(keyword.value.toLocaleLowerCase()) !== -1)
        .filter(v => isValidResource(v.resource)))

  const modrinth = ref(undefined as SearchResult | undefined)
  const curseforge = ref(undefined as {
    data: CFMod[]
    pagination: Pagination
  } | undefined)

  const processModrinth = async (useForge: boolean, useFabric: boolean, offset: number, append: boolean) => {
    try {
      const facets = [`["versions:${runtime.value.minecraft}"]`, '["project_type:mod"]']
      if (useForge) {
        facets.push('["categories:forge"]')
      }
      if (useFabric) {
        facets.push('["categories:fabric"]')
      }
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

  const processCurseforge = async (useForge: boolean, useFabric: boolean, offset: number, append: boolean) => {
    if (keyword.value) {
      try {
        const remain = append && curseforge.value ? curseforge.value.pagination.totalCount - offset : Number.MAX_SAFE_INTEGER
        const result = await clientCurseforgeV1.searchMods({
          classId: 6, // mods
          sortField: ModsSearchSortField.Name,
          modLoaderType: useForge ? FileModLoaderType.Forge : useFabric ? FileModLoaderType.Fabric : FileModLoaderType.Any,
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
      await processCurseforge(!!runtime.value.forge, !!runtime.value.fabricLoader, curseforgePage.value * 20, true)
    }
  }, 1000)
  const loadMoreModrinth = debounce(async () => {
    if (canModrinthLoadMore.value) {
      modrinthPage.value += 1
      loadingModrinth.value = true
      await processModrinth(!!runtime.value.forge, !!runtime.value.fabricLoader, modrinthPage.value * 20, true)
    }
  }, 1000)

  const onSearch = debounce(async () => {
    const useForge = !!runtime.value.forge
    const useFabric = !!runtime.value.fabricLoader
    loadingModrinth.value = true
    loadingCurseforge.value = true
    modrinthPage.value = 0
    curseforgePage.value = 0
    processModrinth(useForge, useFabric, modrinthPage.value * 20, false)
    processCurseforge(useForge, useFabric, curseforgePage.value * 20, false)
  }, 1000)

  watch(keyword, onSearch)

  return {
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
