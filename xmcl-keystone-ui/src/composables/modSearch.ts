import { FileModLoaderType, Mod, ModsSearchSortField, Pagination } from '@xmcl/curseforge'
import { SearchResult } from '@xmcl/modrinth'
import { CurseForgeServiceKey, ModrinthServiceKey, Resource } from '@xmcl/runtime-api'
import { filter } from 'fuzzy'
import debounce from 'lodash.debounce'
import { Ref } from 'vue'
import { kMods, useMods } from './mods'
import { useService } from './service'

export function useModsSearch(keyword: Ref<string>, minecraft: Ref<string>, forge: Ref<string | undefined>, fabricLoader: Ref<string | undefined>) {
  const { resources, refreshing: loading } = inject(kMods, () => useMods(), true)
  const { searchProjects: searchModrinth } = useService(ModrinthServiceKey)
  const { searchProjects: searchCurseforge } = useService(CurseForgeServiceKey)

  const isValidResource = (r: Resource) => {
    const useForge = !!forge.value
    const useFabric = !!fabricLoader.value
    if (useForge) return !!r.metadata.forge
    if (useFabric) return !!r.metadata.fabric
    return false
  }
  const mods = computed(() => keyword.value
    ? filter(keyword.value, resources.value, {
      extract(r) {
        return `${r.name} ${r.fileName}`
      },
    }).map((r) => r.original ? r.original : r as any as Resource).filter(isValidResource)
    : resources.value.filter(isValidResource))
  const modrinth = ref(undefined as SearchResult | undefined)
  const curseforge = ref(undefined as {
    data: Mod[]
    pagination: Pagination
  } | undefined)

  const processModrinth = async (useForge: boolean, useFabric: boolean) => {
    const facets = [`["versions:${minecraft.value}"]`, '["project_type:mod"]']
    if (useForge) {
      facets.push('["categories:forge"]')
    }
    if (useFabric) {
      facets.push('["categories:fabric"]')
    }
    if (keyword.value) {
      modrinth.value = await searchModrinth({
        query: keyword.value,
        facets: '[' + facets.join(',') + ']',
        index: 'relevance',
        offset: 0,
        limit: 20,
      })
    }
  }

  const processCurseforge = async (useForge: boolean, useFabric: boolean) => {
    if (keyword.value) {
      curseforge.value = await searchCurseforge({
        classId: 6, // mods
        sortField: ModsSearchSortField.Name,
        modLoaderType: useForge ? FileModLoaderType.Forge : useFabric ? FileModLoaderType.Fabric : FileModLoaderType.Any,
        gameVersion: minecraft.value,
        searchFilter: keyword.value,
        pageSize: 20,
        index: 0,
      })
    }
  }

  const modrinthError = ref(undefined as any)
  const loadingModrinth = ref(false)
  const curseforgeError = ref(undefined as any)
  const loadingCurseforge = ref(false)

  const onSearch = debounce(async () => {
    const useForge = !!forge.value
    const useFabric = !!fabricLoader.value

    loadingModrinth.value = true
    processModrinth(useForge, useFabric).catch((e) => {
      modrinthError.value = e
    }).finally(() => {
      loadingModrinth.value = false
    })

    loadingCurseforge.value = true
    processCurseforge(useForge, useFabric).catch((e) => {
      curseforgeError.value = e
    }).finally(() => {
      loadingCurseforge.value = false
    })
  }, 1000)

  watch(keyword, onSearch)

  return {
    modrinthError,
    loadingModrinth,
    curseforgeError,
    loadingCurseforge,
    mods,
    modrinth,
    curseforge,
    keyword,
  }
}
