import { isNoModLoader } from '@/util/isNoModloader'
import { ModFile, getModFileFromResource } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { InstanceData, Resource, ResourceDomain, ResourceServiceKey, RuntimeVersions } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { InjectionKey, Ref } from 'vue'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { useMarketSort } from './marketSort'
import { useModrinthSearch } from './modrinthSearch'
import { searlizers, useQueryOverride } from './query'
import { useResourceEffect } from './resources'
import { useService } from './service'
import { useAggregateProjects, useProjectsFilterSearch } from './useAggregateProjects'

export const kModsSearch: InjectionKey<ReturnType<typeof useModsSearch>> = Symbol('ModsSearch')

export enum ModLoaderFilter {
  fabric = 'fabric',
  forge = 'forge',
  quilt = 'quilt',
  neoforge = 'neoforge',
}

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

const kCached = Symbol('cached')

export function useLocalModsSearch(keyword: Ref<string>, modLoaderFilters: Ref<ModLoaderFilter[]>, runtime: Ref<InstanceData['runtime']>, instanceModFiles: Ref<ModFile[]>) {
  const useForge = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.forge) !== -1)
  const useFabric = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.fabric) !== -1)
  const useQuilt = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.quilt) !== -1)
  const useNeoforge = computed(() => modLoaderFilters.value.indexOf(ModLoaderFilter.neoforge) !== -1)

  const isValidResource = (r: Resource) => {
    if (useForge.value || useNeoforge.value) return !!r.metadata.forge
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
    const indices: Record<string, ProjectEntry<ModFile>> = {}
    const _all: ProjectEntry<ModFile>[] = []
    const _installed: ProjectEntry<ModFile>[] = []

    let hasOptifine = false

    const processModFile = (m: ModFile, instanceFile: boolean) => {
      if (m.modId === 'OptiFine') {
        hasOptifine = true
        if (indices.OptiFine) {
          indices.OptiFine.files?.push(m)
          if (instanceFile) {
            indices.OptiFine.installed?.push(m)
          }
          return
        } else {
          const mod = getOptifineAsMod()
          if (instanceFile) {
            mod.installed?.push(m)
          }
          mod.files?.push(m)
          indices.OptiFine = mod
          return mod
        }
      }
      const curseforgeId = m.resource.metadata.curseforge?.projectId
      const modrinthId = m.resource.metadata.modrinth?.projectId
      const name = m.name
      const id = modrinthId || curseforgeId?.toString() || name
      const obj = indices[name] || (modrinthId && indices[modrinthId]) || (curseforgeId && indices[curseforgeId])
      if (obj) {
        obj.files?.push(m)
        if (instanceFile) {
          obj.installed?.push(m)
          obj.disabled = !obj.installed[0].enabled
        }
      } else {
        const mod: ProjectEntry<ModFile> = markRaw({
          id,
          author: m.authors[0] ?? '',
          icon: m.icon,
          title: name,
          disabled: false,
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
          mod.disabled = !mod.installed[0].enabled
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

    if (!hasOptifine) {
      const hasOptifine = keyword.value.toLowerCase().includes('optifine')
      if (hasOptifine && runtime.value.optifine) {
        _installed.push(getOptifineAsMod())
      } else if (hasOptifine) {
        _all.push(getOptifineAsMod())
      }
    }

    return markRaw([_all, _installed] as const)
  })

  const all = computed(() => result.value[0])
  const instances = computed(() => result.value[1])

  async function processCachedMod() {
    if (keyword.value) {
      const searched = await getResourcesByKeyword(keyword.value, ResourceDomain.Mods)
      const resources = searched.filter(isValidResource).map(r => getModFileFromResource(r, runtime.value))
      modFiles.value = resources
    } else {
      modFiles.value = []
    }
  }

  const loadingCached = ref(false)

  const onSearch = async () => {
    loadingCached.value = true
    processCachedMod().finally(() => {
      loadingCached.value = false
    })
  }

  function effect() {
    useResourceEffect(onSearch, ResourceDomain.Mods)
    watch([keyword, instanceModFiles], onSearch)
    watch(modLoaderFilters, onSearch, { deep: true })
  }

  return {
    cached: all,
    effect,
    instances,
    loadingCached,
  }
}

const getOptifineAsMod = () => {
  const result: ProjectEntry<ModFile> = {
    id: 'OptiFine',
    icon: 'http://launcher/icons/optifine',
    title: 'Optifine',
    author: 'sp614x',
    description: 'Optifine is a Minecraft optimization mod. It allows Minecraft to run faster and look better with full support for HD textures and many configuration options.',
    installed: [],
    files: [],
    downloadCount: 0,
    followerCount: 0,
  }
  return result
}

export function useModsSearch(runtime: Ref<InstanceData['runtime']>, instanceMods: Ref<ModFile[]>, isValidating: Ref<boolean>) {
  const modLoaderFilters = ref<ModLoaderFilter[]>([])
  const curseforgeCategory = ref(undefined as number | undefined)
  const modrinthCategories = ref([] as string[])
  const keyword = ref('')
  const gameVersion = ref('')
  const isModrinthActive = ref(true)
  const isCurseforgeActive = ref(true)
  const sort = ref(0)

  const { modrinthSort, curseforgeSort } = useMarketSort(sort)

  const { loadMoreModrinth, loadingModrinth, modrinth, modrinthError, effect: onModrinthEffect } = useModrinthSearch('mod', keyword, modLoaderFilters, modrinthCategories, modrinthSort, gameVersion)
  const { loadMoreCurseforge, loadingCurseforge, curseforge, curseforgeError, effect: onCurseforgeEffect } = useCurseforgeSearch<ProjectEntry<ModFile>>(CurseforgeBuiltinClassId.mod, keyword, modLoaderFilters, curseforgeCategory, curseforgeSort, gameVersion)
  const { cached: cachedMods, instances, loadingCached, effect: onLocalEffect } = useLocalModsSearch(keyword, modLoaderFilters, runtime, instanceMods)
  const loading = computed(() => loadingModrinth.value || loadingCurseforge.value || loadingCached.value || isValidating.value)

  const all = useAggregateProjects<ProjectEntry<ModFile>>(
    modrinth,
    curseforge,
    cachedMods,
    instances,
  )

  const networkOnly = computed(() => {
    if (keyword.value.length > 0) {
      return true
    }
    if ((modrinth.value.length > 0 || curseforge.value.length > 0)) {
      return true
    }
    if (modrinthCategories.value.length > 0) {
      return true
    }
    if (curseforgeCategory.value !== undefined) {
      return true
    }
    return false
  })
  const items = useProjectsFilterSearch(
    keyword,
    all,
    networkOnly,
    isCurseforgeActive,
    isModrinthActive,
  )

  const getModloaders = (version: RuntimeVersions) => {
    const items = [] as ModLoaderFilter[]
    if (isNoModLoader(version)) {
      items.push(ModLoaderFilter.fabric, ModLoaderFilter.forge, ModLoaderFilter.quilt, ModLoaderFilter.neoforge)
    } else {
      if (version.fabricLoader) {
        items.push(ModLoaderFilter.fabric)
      }
      if (version.forge) {
        items.push(ModLoaderFilter.forge)
      }
      if (version.quiltLoader) {
        items.push(ModLoaderFilter.quilt, ModLoaderFilter.fabric)
      }
      if (version.neoForged) {
        items.push(ModLoaderFilter.neoforge)
      }
    }
    return items
  }

  function effect() {
    onModrinthEffect()
    onCurseforgeEffect()
    onLocalEffect()

    useQueryOverride('gameVersion', gameVersion, computed(() => runtime.value.minecraft), searlizers.string)
    useQueryOverride('modLoaders', modLoaderFilters, computed(() => getModloaders(runtime.value)), searlizers.stringArray)
    useQueryOverride('curseforgeCategory', curseforgeCategory, undefined, searlizers.number)
    useQueryOverride('modrinthCategories', modrinthCategories, [], searlizers.stringArray)
    useQueryOverride('keyword', keyword, '', searlizers.string)
    useQueryOverride('modrinthActive', isModrinthActive, true, searlizers.boolean)
    useQueryOverride('curseforgeActive', isCurseforgeActive, true, searlizers.boolean)
    useQueryOverride('sort', sort, 0, searlizers.number)
  }

  return {
    gameVersion,
    modLoaderFilters,
    curseforgeCategory,
    modrinthCategories,
    loadMoreCurseforge,
    loadMoreModrinth,
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
    items,
    all,
    isModrinthActive,
    isCurseforgeActive,
    sort,
    effect,
  }
}
