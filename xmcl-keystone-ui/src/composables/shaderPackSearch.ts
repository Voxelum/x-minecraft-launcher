import { basename } from '@/util/basename'
import { injection } from '@/util/inject'
import { ModFile } from '@/util/mod'
import { ProjectEntry } from '@/util/search'
import { InjectionKey, Ref } from 'vue'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { InstanceShaderFile } from './instanceShaderPack'
import { useMarketCollectionSearch } from './marketCollectionSearch'
import { kModrinthAuthenticatedAPI } from './modrinthAuthenticatedAPI'
import { useModrinthSearch } from './modrinthSearch'
import { SearchModel } from './search'
import { useMergedProjects, useProjectsSort } from './useAggregateProjects'
import { useLocalStorageCacheStringValue } from './cache'
import { LocalSort } from './sortBy'

export const kShaderPackSearch: InjectionKey<ReturnType<typeof useShaderPackSearch>> = Symbol('ShaderPackSearch')

export enum ShaderLoaderFilter {
  optifine = 'optifine',
  iris = 'iris',
}

/**
 * Represent a mod project
 */
export type ShaderPackProject = ProjectEntry<InstanceShaderFile>

function useLocalSearch(shaderProjectFiles: Ref<InstanceShaderFile[]>, { keyword }: SearchModel) {
  const all = computed(() => {
    const indices: Record<string, ShaderPackProject> = {}
    const _all: ShaderPackProject[] = markRaw([])

    const getFromResource = (m: InstanceShaderFile) => {
      const curseforgeId = m.curseforge?.projectId
      const modrinthId = m.modrinth?.projectId
      const name = basename(m.path)
      const obj = indices[name] || (modrinthId && indices[modrinthId]) || (curseforgeId && indices[curseforgeId])
      if (obj) {
        obj.installed?.push(m)
        obj.files?.push(m)
        obj.disabled = m.enabled ? false : obj.disabled
      } else {
        const proj: ShaderPackProject = markRaw({
          id: name,
          author: '',
          icon: '',
          title: name,
          disabled: !m.enabled,
          description: name,
          installed: [m],
          downloadCount: 0,
          followerCount: 0,
          modrinthProjectId: modrinthId,
          curseforgeProjectId: curseforgeId,
          files: [m],
        })
        indices[name] = proj
        if (modrinthId) {
          indices[modrinthId] = proj
        }
        if (curseforgeId) {
          indices[curseforgeId] = proj
        }
        return proj
      }
    }

    for (const m of shaderProjectFiles.value) {
      const mod = getFromResource(m)
      if (mod) {
        _all.push(mod)
      }
    }

    return _all
  })
  const filtered = computed(() => all.value.filter(v => v.title.toLowerCase().includes(keyword.value.toLowerCase())))

  const loadingCached = ref(false)

  function effect() {
  }

  return {
    all,
    filtered,
    loadingCached,
    effect,
  }
}

export function useShaderPackSearch(shaderPacks: Ref<InstanceShaderFile[]>,
  { collections, follows } = injection(kModrinthAuthenticatedAPI), searchModel: SearchModel) {
  const { loadMoreModrinth, loadingModrinth, modrinth, modrinthError, effect: modrinthEffect } = useModrinthSearch<ShaderPackProject>('shader', {
    ...searchModel,
    modLoaders: [ShaderLoaderFilter.optifine, ShaderLoaderFilter.iris],
  })
  const { loadMoreCurseforge, loadingCurseforge, curseforge, curseforgeError, effect: onCurseforgeEffect } = useCurseforgeSearch<ProjectEntry<ModFile>>(CurseforgeBuiltinClassId.shaderPack, searchModel)
  const { filtered, all, loadingCached, effect: localEffect } = useLocalSearch(shaderPacks, searchModel)
  const loading = computed(() => loadingModrinth.value || loadingCached.value || loadingCurseforge.value)
  const { currentView } = searchModel
  const { items: collectionItems, effect: onCollectionsEffect } = useMarketCollectionSearch('shader', searchModel, collections, follows)
  const sortBy = useLocalStorageCacheStringValue('shaderPackSort', '' as LocalSort)

  const error = computed(() => curseforgeError.value || modrinthError.value)

  function effect() {
    modrinthEffect()
    onCurseforgeEffect()
    localEffect()
    onCollectionsEffect()
    searchModel.effect(() => undefined)
  }

  const merged = useMergedProjects<ShaderPackProject>(
    computed(() => {
      const view = currentView.value
      if (view === 'local') {
        return [filtered.value, all.value]
      }
      if (view === 'favorite') {
        return [collectionItems.value, all.value]
      }
      return [
        [
          ...modrinth.value,
          ...curseforge.value,
        ],
        all.value,
      ]
    }),
  )

  const items = useProjectsSort(
    searchModel.keyword,
    merged,
  )

  function loadMore() {
    loadMoreModrinth()
    loadMoreCurseforge()
  }

  return {
    sortBy,
    error,
    items,
    loadMore,
    loading,
    effect,
  }
}
