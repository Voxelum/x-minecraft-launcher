import { BuiltinImages } from '@/constant'
import { isNoModLoader } from '@/util/isNoModloader'
import { ModFile, getModFileFromResource } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { getDiceCoefficient } from '@/util/sort'
import { InstanceData, InstanceModsServiceKey, ProjectMapping, ProjectMappingServiceKey, Resource, RuntimeVersions, Settings } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { useMarketSort } from './marketSort'
import { useModrinthSearch } from './modrinthSearch'
import { searlizers, useQueryOverride } from './query'
import { useService } from './service'
import { useAggregateProjects, useProjectsFilterSort } from './useAggregateProjects'
import { notNullish } from '@vueuse/core'

export const kModsSearch: InjectionKey<ReturnType<typeof useModsSearch>> = Symbol('ModsSearch')

export enum ModLoaderFilter {
  fabric = 'fabric',
  forge = 'forge',
  quilt = 'quilt',
  neoforge = 'neoforge',
}

const kCached = Symbol('cached')

export function useLocalModsSearch(path: Ref<string>, keyword: Ref<string>, modLoaderFilters: Ref<ModLoaderFilter[]>, runtime: Ref<InstanceData['runtime']>, instanceModFiles: Ref<ModFile[]>) {
  const { searchInstalled } = useService(InstanceModsServiceKey)
  const modFiles = ref([] as ModFile[])

  const result = computed(() => {
    const indices: Record<string, ProjectEntry<ModFile>> = {}
    const _all: ProjectEntry<ModFile>[] = []
    const _installed: ProjectEntry<ModFile>[] = []
    const _installedAll: ProjectEntry<ModFile>[] = []
    const key = keyword.value

    const getOrDecorateProjectEntry = (m: ModFile, instanceFile: boolean) => {
      if (m.modId === 'OptiFine') {
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
      const curseforgeId = m.curseforge?.projectId
      const modrinthId = m.modrinth?.projectId
      const name = m.name
      const id = modrinthId || curseforgeId?.toString() || name
      const obj = indices[name] || (modrinthId && indices[modrinthId]) || (curseforgeId && indices[curseforgeId])
      if (obj) {
        obj.files?.push(m)
        if (instanceFile) {
          if (!obj.installed.some(i => i.path === m.path)) {
            obj.installed?.push(m)
          }
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
          if (!mod.installed.some(i => i.path === m.path)) {
            mod.installed.push(m)
          }
          mod.disabled = !mod.installed[0].enabled
        }
        return mod
      }
    }

    for (const m of instanceModFiles.value) {
      const mod = getOrDecorateProjectEntry(m, true)
      if (!mod) { continue }
      const matched = m.name.toLocaleLowerCase().indexOf(key.toLocaleLowerCase()) !== -1
      if (matched) {
        _installed.push(mod)
      }
      _installedAll.push(mod)
    }

    for (const m of modFiles.value) {
      const mod = getOrDecorateProjectEntry(m, false)
      if (mod) {
        _all.push(mod)
      }
    }

    if (!indices.OptiFine) {
      // If no OptiFine in cache or instance, and the keyword contains 'optifine', add it to the list
      const ef = getDiceCoefficient(keyword.value, 'optifine')
      const hasKeyword = ef > 0.5
      if (hasKeyword) {
        if (runtime.value.optifine) {
          _installed.push(getOptifineAsMod())
        } else if (hasKeyword) {
          _all.push(getOptifineAsMod())
        }
      }
    }

    return markRaw([_all, _installed, _installedAll] as const)
  })

  const all = computed(() => result.value[0])
  const instances = computed(() => result.value[1])
  const instancesAll = computed(() => result.value[2])

  async function searchLocalMods() {
    const kw = keyword.value
    if (!kw) {
      modFiles.value = []
      return
    }
    const useForge = modLoaderFilters.value.indexOf(ModLoaderFilter.forge) !== -1
    const useFabric = modLoaderFilters.value.indexOf(ModLoaderFilter.fabric) !== -1
    const useQuilt = modLoaderFilters.value.indexOf(ModLoaderFilter.quilt) !== -1
    const useNeoforge = modLoaderFilters.value.indexOf(ModLoaderFilter.neoforge) !== -1
    const isValidResource = (r: Resource) => {
      // should not include this instance mods
      if (r.path.startsWith(path.value)) {
        return false
      }

      if (useForge || useNeoforge) return !!r.metadata.forge
      if (useFabric) return !!r.metadata.fabric
      if (useQuilt) return !!r.metadata.quilt
      return false
    }
    const searched = await searchInstalled(kw)
    const resources = searched.filter(isValidResource).map(r => getModFileFromResource(r, runtime.value))
    modFiles.value = resources
  }

  const loadingCached = ref(false)

  const onSearch = async () => {
    loadingCached.value = true
    searchLocalMods().finally(() => {
      loadingCached.value = false
    })
  }

  function effect() {
    // useResourceEffect(onSearch, ResourceDomain.Mods)
    watch([keyword, instanceModFiles], onSearch)
    watch(modLoaderFilters, onSearch, { deep: true })
  }

  return {
    cached: all,
    effect,
    instances,
    instancesAll,
    loadingCached,
  }
}

const getOptifineAsMod = () => {
  const result: ProjectEntry<ModFile> = {
    id: 'OptiFine',
    icon: BuiltinImages.optifine,
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

export function useModsSearch(path: Ref<string>, runtime: Ref<InstanceData['runtime']>, instanceMods: Ref<ModFile[]>, isValidating: Ref<boolean>, settings: Ref<Settings | undefined>) {
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
  const { cached: cachedMods, instances, instancesAll, loadingCached, effect: onLocalEffect } = useLocalModsSearch(path, keyword, modLoaderFilters, runtime, instanceMods)
  const loading = computed(() => loadingModrinth.value || loadingCurseforge.value || loadingCached.value || isValidating.value)

  const all = useAggregateProjects<ProjectEntry<ModFile>>(
    modrinth,
    curseforge,
    cachedMods,
    instances,
    instancesAll,
  )

  const networkOnly = computed(() => {
    if (modrinthCategories.value.length > 0) {
      return true
    }
    if (curseforgeCategory.value !== undefined) {
      return true
    }
    return false
  })
  const items = useProjectsFilterSort(
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

  const { lookupBatch } = useService(ProjectMappingServiceKey)

  const mapping = shallowRef<Record<string, ProjectMapping>>({})
  watch([items, computed(() => settings.value?.locale)], ([newItems]) => {
    const modrinthsToLookup = newItems.map(i => i.modrinthProjectId || i.modrinth?.project_id).filter(notNullish)
    const curseforgesToLookup = newItems.map(i => i.curseforgeProjectId || i.curseforge?.id).filter(notNullish)

    lookupBatch(modrinthsToLookup, curseforgesToLookup).then((result) => {
      const newDict: Record<string, ProjectMapping> = {}
      for (const r of result) {
        if (r.modrinthId) {
          newDict[r.modrinthId] = r
        }
        if (r.curseforgeId) {
          newDict[r.curseforgeId] = r
        }
      }
      mapping.value = newDict
    })
  })

  const localizedItems = computed(() => {
    const oldItems = items.value

    const result = oldItems.map((item) => {
      const mrId = item.modrinthProjectId || item.modrinth?.project_id
      const cfId = item.curseforgeProjectId || item.curseforge?.id
      const id = mrId || cfId?.toString()
      if (id) {
        const map = mapping.value[id]
        if (map) {
          item.localizedTitle = map.name
          item.localizedDescription = map.description
          if (map.modrinthId && !item.modrinthProjectId) {
            item.modrinthProjectId = map.modrinthId
          }
          if (map.curseforgeId && !item.curseforgeProjectId) {
            item.curseforgeProjectId = map.curseforgeId
          }
        }
      }
      return item
    })

    return result
  })

  function effect() {
    onModrinthEffect()
    onCurseforgeEffect()
    onLocalEffect()

    useQueryOverride('gameVersion', gameVersion, computed(() => runtime.value.minecraft), searlizers.string)
    useQueryOverride('modLoader', modLoaderFilters, computed(() => getModloaders(runtime.value)), {
      fromString: (v) => [v],
      toString: (v) => v[0],
    })
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
    loadingCached,
    loadingCurseforge,
    modrinth,
    curseforge,
    keyword,
    loading,
    items: localizedItems,
    all,
    isModrinthActive,
    isCurseforgeActive,
    sort,
    effect,
  }
}
