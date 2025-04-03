import { BuiltinImages } from '@/constant'
import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { ModFile, getModFileFromResource } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { getDiceCoefficient } from '@/util/sort'
import { notNullish } from '@vueuse/core'
import { InstanceData, InstanceModsServiceKey, ProjectMapping, ProjectMappingServiceKey, Resource, RuntimeVersions, Settings } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useLocalStorageCacheBool, useLocalStorageCacheStringValue } from './cache'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { useI18nSearch } from './i18nSearch'
import { useMarketCollectionSearch } from './marketCollectionSearch'
import { kModrinthAuthenticatedAPI } from './modrinthAuthenticatedAPI'
import { useModrinthSearch } from './modrinthSearch'
import { ModLoaderFilter, SearchModel } from './search'
import { useService } from './service'
import { useMergedProjects, useProjectsSort } from './useAggregateProjects'

export const kModsSearch: InjectionKey<ReturnType<typeof useModsSearch>> = Symbol('ModsSearch')

const kCached = Symbol('cached')

function useLocalModsSearch(path: Ref<string>, runtime: Ref<InstanceData['runtime']>, instanceModFiles: Ref<ModFile[]>, {
  keyword,
  modLoader,
}: SearchModel) {
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
        const mod = markRaw({
          id,
          author: m.authors[0] ?? '',
          icon: m.icon,
          title: name,
          disabled: false,
          description: m.description,
          installed: [],
          downloadCount: 0,
          followerCount: 0,
          modrinthProjectId: modrinthId,
          curseforgeProjectId: curseforgeId,
          files: [m],
        } as ProjectEntry<ModFile>)
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
      const lower = key.toLocaleLowerCase()
      const matched = m.name.toLocaleLowerCase().indexOf(lower) !== -1
        || basename(m.path).toLocaleLowerCase().indexOf(lower) !== -1
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

    // all cached, installed filtered by keywords, installedAll is all installed mods
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
    const useForge = modLoader.value === ModLoaderFilter.forge
    const useFabric = modLoader.value === ModLoaderFilter.fabric
    const useQuilt = modLoader.value === ModLoaderFilter.quilt
    const useNeoforge = modLoader.value === ModLoaderFilter.neoforge
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
    watch(modLoader, onSearch, { deep: true })
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

export function useModsSearch(path: Ref<string>, runtime: Ref<InstanceData['runtime']>, instanceMods: Ref<ModFile[]>, isValidating: Ref<boolean>, settings: Ref<Settings | undefined>,
  { collections, follows } = injection(kModrinthAuthenticatedAPI), searchModel: SearchModel) {
  const {
    keyword,
    currentView,
  } = searchModel

  const { loadMoreModrinth, loadingModrinth, modrinth, modrinthError, effect: onModrinthEffect } = useModrinthSearch('mod', searchModel)
  const { loadMoreCurseforge, loadingCurseforge, curseforge, curseforgeError, effect: onCurseforgeEffect } = useCurseforgeSearch<ProjectEntry<ModFile>>(
    CurseforgeBuiltinClassId.mod, searchModel)
  const { projects: i18nProjects, effect: onI18nEffect } = useI18nSearch(searchModel)
  const { cached: cachedMods, instances, instancesAll, loadingCached, effect: onLocalEffect } = useLocalModsSearch(path, runtime, instanceMods, searchModel)
  const { items: collectionItems, effect: onCollectionsEffect } = useMarketCollectionSearch('mod', searchModel, collections, follows)
  const error = computed(() => modrinthError.value || curseforgeError.value)

  const loading = computed(() => loadingModrinth.value || loadingCurseforge.value || loadingCached.value || isValidating.value)

  const all = useMergedProjects<ProjectEntry<ModFile>>(
    computed(() => {
      const view = currentView.value
      if (view === 'local') {
        return [instances.value, [...cachedMods.value, ...instancesAll.value]]
      }
      if (view === 'favorite') {
        return [collectionItems.value, [...cachedMods.value, ...instancesAll.value]]
      }
      return [[
        ...modrinth.value,
        ...curseforge.value,
        ...i18nProjects.value,
        ...cachedMods.value,
      ], [...instancesAll.value, ...instances.value]
      ]
    }),
  )

  const items = useProjectsSort(
    keyword,
    all,
  )

  const { lookupBatch } = useService(ProjectMappingServiceKey)

  const mapping = shallowRef<Record<string, ProjectMapping>>({})
  watch([items, computed(() => settings.value?.locale)], ([newItems]) => {
    const filtered = newItems
    const modrinthsToLookup = filtered.map(i => i.modrinthProjectId || i.modrinth?.project_id).filter(notNullish)
    const curseforgesToLookup = filtered.map(i => i.curseforgeProjectId || i.curseforge?.id).filter(notNullish)

    lookupBatch(modrinthsToLookup, curseforgesToLookup).then((result) => {
      const newDict: Record<string, ProjectMapping> = {}
      for (const r of result) {
        if (r.modrinthId) {
          newDict[r.modrinthId] = markRaw(r)
        }
        if (r.curseforgeId) {
          newDict[r.curseforgeId] = markRaw(r)
        }
      }
      mapping.value = markRaw(newDict)
    })
  })

  const localizedItems = computed(() => {
    const oldItems = items.value
    const maps = mapping.value

    const result = oldItems.map((item) => {
      const mrId = item.modrinthProjectId || item.modrinth?.project_id
      const cfId = item.curseforgeProjectId || item.curseforge?.id
      const id = mrId || cfId?.toString()
      if (id) {
        const map = maps[id]
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

  const getModloader = (version: RuntimeVersions) => {
    if (version.fabricLoader) {
      return ModLoaderFilter.fabric
    }
    if (version.forge) {
      return ModLoaderFilter.forge
    }
    if (version.quiltLoader) {
      return ModLoaderFilter.quilt
    }
    if (version.neoForged) {
      return ModLoaderFilter.neoforge
    }
  }

  function effect() {
    searchModel.effect(() => getModloader(runtime.value))
    onModrinthEffect()
    onCurseforgeEffect()
    onLocalEffect()
    onI18nEffect()
    onCollectionsEffect()
    localFilter.value = ''
  }

  function loadMore() {
    loadMoreModrinth()
    loadMoreCurseforge()
  }

  const localFilter = ref('' as '' | 'disabledOnly' | 'incompatibleOnly' | 'hasUpdateOnly' | 'unusedOnly' | 'dependenciesInstallOnly')
  const sortBy = useLocalStorageCacheStringValue('modSort', '' as '' | 'alpha_asc' | 'alpha_desc' | 'time_asc' | 'time_desc')
  const denseView = useLocalStorageCacheBool('mod-dense-view', false)
  const groupInstalled = useLocalStorageCacheBool('mod-group-installed', true)

  return {
    localFilter,
    sortBy,
    denseView,
    groupInstalled,

    loadMore,
    error,
    loading,
    items: localizedItems,
    effect,
  }
}
