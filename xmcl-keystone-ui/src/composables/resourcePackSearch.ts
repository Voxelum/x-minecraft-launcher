import { injection } from '@/util/inject'
import { ProjectEntry } from '@/util/search'
import { TextComponent } from '@xmcl/text-component'
import { InjectionKey, Ref } from 'vue'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { InstanceResourcePack } from './instanceResourcePack'
import { useMarketCollectionSearch } from './marketCollectionSearch'
import { kModrinthAuthenticatedAPI } from './modrinthAuthenticatedAPI'
import { useModrinthSearch } from './modrinthSearch'
import { SearchModel } from './search'
import { useMergedProjects, useProjectsSort } from './useAggregateProjects'
import { useLocalStorageCacheStringValue } from './cache'
import { LocalSort } from './sortBy'

export const kResourcePackSearch: InjectionKey<ReturnType<typeof useResourcePackSearch>> = Symbol('ResourcePackSearch')

/**
 * Represent a mod project
 */
export type ResourcePackProject = ProjectEntry<InstanceResourcePack>

function useLocalSearch(enabled: Ref<InstanceResourcePack[]>, disabled: Ref<InstanceResourcePack[]>, {
  keyword
}: SearchModel) {
  const all = computed(() => {
    const indices: Record<string, ResourcePackProject> = {}
    const _all: ResourcePackProject[] = []

    const getFromResource = (m: InstanceResourcePack, enabled: boolean) => {
      const curseforgeId = m.curseforge?.projectId
      const modrinthId = m.modrinth?.projectId
      const name = m.name.startsWith('file/') ? m.name.slice(5) : m.name
      const obj = indices[name] || (modrinthId && indices[modrinthId]) || (curseforgeId && indices[curseforgeId])
      if (obj) {
        obj.files?.push(m)
        obj.installed?.push(m)
      } else {
        const proj = markRaw({
          id: m.id,
          author: '',
          icon: m.icon,
          title: name,
          disabled: !enabled,
          description: typeof m.description === 'string' ? m.description : '',
          descriptionTextComponent: typeof m.description === 'object' ? m.description as TextComponent : undefined,
          installed: [m],
          downloadCount: 0,
          followerCount: 0,
          modrinthProjectId: modrinthId,
          curseforgeProjectId: curseforgeId,
          files: [m],
        } as ResourcePackProject)
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

    for (const m of enabled.value) {
      const mod = getFromResource(m, true)
      if (mod) {
        _all.push(mod)
      }
    }

    for (const m of disabled.value) {
      const pack = getFromResource(m, false)
      if (pack) {
        _all.push(pack)
      }
    }

    return markRaw(_all)
  })

  const loadingCached = ref(false)

  const filtered = computed(() => all.value.filter(v => v.title.toLowerCase().includes(keyword.value.toLowerCase())))

  function effect() { }

  return {
    filtered,
    all,
    loadingCached,
    effect,
  }
}

export function useResourcePackSearch(_enabled: Ref<InstanceResourcePack[]>, _disabled: Ref<InstanceResourcePack[]>,
  { collections, follows } = injection(kModrinthAuthenticatedAPI), searchModel: SearchModel) {
  const { loadMoreModrinth, loadingModrinth, modrinth, modrinthError, effect: modrinthEffect } = useModrinthSearch<ResourcePackProject>('resourcepack', searchModel)
  const { loadMoreCurseforge, loadingCurseforge, curseforge, curseforgeError, effect: curseforgeEffect } = useCurseforgeSearch(CurseforgeBuiltinClassId.resourcePack, searchModel)
  const { filtered, all, loadingCached, effect: localEffect } = useLocalSearch(_enabled, _disabled, searchModel)
  const loading = computed(() => loadingModrinth.value || loadingCached.value || loadingCurseforge.value)
  const { items: collectionItems, effect: onCollectionsEffect } = useMarketCollectionSearch('resourcepack', searchModel, collections, follows)
  const { currentView } = searchModel
  const sortBy = useLocalStorageCacheStringValue('resourcePackSort', '' as LocalSort)

  const merged = useMergedProjects<ResourcePackProject>(
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

  const error = computed(() => curseforgeError.value || modrinthError.value)

  function effect() {
    modrinthEffect()
    curseforgeEffect()
    localEffect()
    onCollectionsEffect()
    searchModel.effect(() => undefined)
  }

  function loadMore() {
    loadMoreModrinth()
    loadMoreCurseforge()
  }

  return {
    sortBy,
    loadMore,
    error,
    items,
    loading,
    effect,
  }
}
