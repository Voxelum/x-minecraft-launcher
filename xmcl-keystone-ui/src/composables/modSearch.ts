import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { getCursforgeModLoadersFromString } from '@/util/curseforge'
import { isNoModLoader } from '@/util/isNoModloader'
import { Mod, ModFile, getModFileFromResource } from '@/util/mod'
import { Mod as CFMod, ModsSearchSortField, Pagination } from '@xmcl/curseforge'
import { SearchResult } from '@xmcl/modrinth'
import { InstanceData, Resource, ResourceDomain, ResourceServiceKey } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref } from 'vue'
import { useResourceEffect } from './resources'
import { useService } from './service'

export const kModsSearch: InjectionKey<ReturnType<typeof useModsSearch>> = Symbol('ModsSearch')

export enum ModLoaderFilter {
  fabric = 'fabric',
  forge = 'forge',
  quilt = 'quilt',
}

export function useModrinthSearch(keyword: Ref<string>, modLoaderFilters: Ref<ModLoaderFilter[]>, runtime: Ref<InstanceData['runtime']>) {
  const modrinth = ref(undefined as SearchResult | undefined)
  const modrinthError = ref(undefined as any)
  const loadingModrinth = ref(false)
  const modrinthPage = ref(0)

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
  const canModrinthLoadMore = computed(() => {
    return modrinth.value && modrinth.value.total_hits > (modrinth.value.offset + modrinth.value.limit)
  })
  const loadMoreModrinth = debounce(async () => {
    if (canModrinthLoadMore.value) {
      modrinthPage.value += 1
      loadingModrinth.value = true
      await processModrinth(modrinthPage.value * 20, true)
    }
  }, 1000)

  const onSearch = async () => {
    loadingModrinth.value = true
    modrinthPage.value = 0
    processModrinth(modrinthPage.value * 20, false)
  }

  watch(keyword, onSearch)

  const mods = computed(() => {
    const modr = modrinth.value
    if (!modr) return []
    const mods: Mod[] = markRaw(modr.hits.map(i => ({
      id: i.project_id,
      icon: i.icon_url,
      title: i.title,
      author: i.author,
      description: i.description,
      downloadCount: i.downloads,
      followerCount: i.follows,
      modrinth: i,
      installed: [],
    })))
    return mods
  })

  return {
    modrinth: mods,
    modrinthError,
    loadMoreModrinth,
    loadingModrinth,
    canModrinthLoadMore,
  }
}

export function useCurseforgeSearch(keyword: Ref<string>, modLoaderFilters: Ref<ModLoaderFilter[]>, runtime: Ref<InstanceData['runtime']>) {
  const curseforge = ref(undefined as {
    data: CFMod[]
    pagination: Pagination
  } | undefined)

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

  const mods = computed(() => {
    const cf = curseforge.value
    if (!cf) return []
    const mods: Mod[] = markRaw(cf.data.map(i => ({
      id: i.id.toString(),
      icon: i.logo?.url ?? '',
      title: i.name,
      author: i.authors[0].name,
      description: i.summary,
      downloadCount: i.downloadCount,
      followerCount: i.thumbsUpCount,
      curseforge: i,
      installed: [],
    })))
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

const kCached = Symbol('cached')

export function useLocalModsSearch(keyword: Ref<string>, modLoaderFilters: Ref<ModLoaderFilter[]>, runtime: Ref<InstanceData['runtime']>, instanceModFiles: Ref<ModFile[]>) {
  const useForge = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.forge) !== -1)
  const useFabric = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.fabric) !== -1)
  const useQuilt = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.quilt) !== -1)

  const isValidResource = (r: Resource) => {
    if (useForge.value) return !!r.metadata.forge
    if (useFabric.value) return !!r.metadata.fabric
    if (useQuilt.value) return !!r.metadata.quilt
    return false
  }
  const { getResourcesByKeyword } = useService(ResourceServiceKey)
  const modFiles = ref([] as ModFile[])

  const instanceMods = computed(() => {
    return keyword.value.length === 0
      ? instanceModFiles.value
      : instanceModFiles.value.filter(m => m.name.toLocaleLowerCase().indexOf(keyword.value.toLocaleLowerCase()) !== -1)
  })

  const result = computed(() => {
    const indices: Record<string, Mod> = {}
    const _all: Mod[] = []
    const _installed: Mod[] = []

    if (runtime.value.optifine) {
      _installed.push(getOptifineAsMod())
    } else {
      const hasOptifine = keyword.value.toLowerCase().includes('optifine')
      if (hasOptifine) {
        _all.push(getOptifineAsMod())
      }
    }

    const processModFile = (m: ModFile, instanceFile: boolean) => {
      const curseforgeId = m.resource.metadata.curseforge?.projectId
      const modrinthId = m.resource.metadata.modrinth?.projectId
      const name = m.name
      const obj = indices[name] || (modrinthId && indices[modrinthId]) || (curseforgeId && indices[curseforgeId])
      if (obj) {
        obj.files?.push(m)
        if (instanceFile) {
          obj.installed?.push(m)
        }
      } else {
        const mod: Mod = markRaw({
          id: name,
          author: m.authors[0] ?? '',
          icon: m.icon,
          title: name,
          description: m.description,
          forge: m.modLoaders.indexOf('forge') !== -1,
          fabric: m.modLoaders.indexOf('fabric') !== -1,
          quilt: m.modLoaders.indexOf('quilt') !== -1,
          installed: [],
          downloadCount: 0,
          followerCount: 0,
          modrinthProjectId: modrinthId,
          curseforgeProjectId: curseforgeId,
          files: [m],
        })
        // @ts-ignore
        mod[kCached] = false
        indices[name] = mod
        if (modrinthId) {
          indices[modrinthId] = mod
        }
        if (curseforgeId) {
          indices[curseforgeId] = mod
        }
        if (instanceFile) {
          mod.installed.push(m)
        }
        return mod
      }
    }

    for (const m of instanceMods.value) {
      const mod = processModFile(m, true)
      if (mod) {
        _installed.push(mod)
      }
    }
    for (const m of modFiles.value) {
      const mod = processModFile(m, false)
      if (mod) {
        _all.push(mod)
      }
    }

    return markRaw([_all, _installed] as const)
  })

  const all = computed(() => result.value[0])
  const instances = computed(() => result.value[1])

  async function processCachedMod() {
    modFiles.value = keyword.value ? (await getResourcesByKeyword(keyword.value, ResourceDomain.Mods)).filter(isValidResource).map(r => getModFileFromResource(r, runtime.value)) : []
  }

  const loadingCached = ref(false)

  const onSearch = async () => {
    loadingCached.value = true
    processCachedMod().finally(() => {
      loadingCached.value = false
    })
  }

  useResourceEffect(onSearch, ResourceDomain.Mods)
  watch([keyword, instanceModFiles], onSearch)
  watch(modLoaderFilters, onSearch, { deep: true })

  return {
    cached: all,
    instances,
    loadingCached,
  }
}

const getOptifineAsMod = () => {
  const result: Mod = {
    id: 'optifine',
    icon: 'image://builtin/optifine',
    title: 'Optifine',
    author: 'sp614x',
    description: 'Optifine is a Minecraft optimization mod. It allows Minecraft to run faster and look better with full support for HD textures and many configuration options.',
    installed: [],
    downloadCount: 0,
    followerCount: 0,
  }
  return result
}

export function useModsSearch(runtime: Ref<InstanceData['runtime']>, instanceMods: Ref<ModFile[]>) {
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

  const { loadMoreModrinth, loadingModrinth, canModrinthLoadMore, modrinth, modrinthError } = useModrinthSearch(keyword, modLoaderFilters, runtime)
  const { loadMoreCurseforge, loadingCurseforge, canCurseforgeLoadMore, curseforge, curseforgeError } = useCurseforgeSearch(keyword, modLoaderFilters, runtime)
  const { cached: cachedMods, instances, loadingCached } = useLocalModsSearch(keyword, modLoaderFilters, runtime, instanceMods)
  const loading = computed(() => loadingModrinth.value || loadingCurseforge.value || loadingCached.value)

  return {
    modLoaderFilters,
    loadMoreCurseforge,
    loadMoreModrinth,
    canCurseforgeLoadMore,
    canModrinthLoadMore,
    modrinthError,
    loadingModrinth,
    curseforgeError,
    cachedMods,
    instanceMods: instances,
    loadingCached,
    loadingCurseforge,
    modrinth,
    curseforge,
    keyword,
    loading,
  }
}
