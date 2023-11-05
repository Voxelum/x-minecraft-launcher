import { clientModrinthV2 } from '@/util/clients'
import { ProjectEntry } from '@/util/search'
import { InstanceData, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { useCurseforgeSearch } from './curseforgeSearch'
import { InstanceResourcePack } from './instanceResourcePack'
import { useModrinthSearch } from './modrinthSearch'
import { useService } from './service'
import { useTabMarketFilter } from './tab'
import { useAggregateProjects, useProjectsFilterSearch } from './useAggregateProjects'

export const kResourcePackSearch: InjectionKey<ReturnType<typeof useResourcePackSearch>> = Symbol('ResourcePackSearch')

/**
 * Represent a mod project
 */
export type ResourcePackProject = ProjectEntry<InstanceResourcePack>

function useLocalSearch(keyword: Ref<string>, enabled: Ref<InstanceResourcePack[]>, disabled: Ref<InstanceResourcePack[]>) {
  const result = computed(() => {
    const indices: Record<string, ResourcePackProject> = {}
    const _all: ResourcePackProject[] = []
    const _enabled: ResourcePackProject[] = []
    const _disabled: ResourcePackProject[] = []

    const getFromResource = (m: InstanceResourcePack, enabled: boolean) => {
      const curseforgeId = m.resource?.metadata.curseforge?.projectId
      const modrinthId = m.resource?.metadata.modrinth?.projectId
      const name = m.name
      const obj = indices[name] || (modrinthId && indices[modrinthId]) || (curseforgeId && indices[curseforgeId])
      if (obj) {
        obj.files?.push(m)
        obj.installed?.push(m)
      } else {
        const proj: ResourcePackProject = markRaw({
          id: m.id,
          author: '',
          icon: m.icon,
          title: name,
          disabled: !enabled,
          description: m.description as string,
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

    for (const m of enabled.value) {
      const mod = getFromResource(m, true)
      if (mod) {
        _all.push(mod)
        _enabled.push(mod)
      }
    }

    for (const m of disabled.value) {
      const pack = getFromResource(m, false)
      if (pack) {
        _all.push(pack)
        _disabled.push(pack)
      }
    }

    return markRaw([_disabled, _enabled, _all] as const)
  })

  const loadingCached = ref(false)

  const _disabled = computed(() => result.value[0])
  const _enabled = computed(() => result.value[1])
  const _all = computed(() => result.value[2].filter(v => v.title.toLowerCase().includes(keyword.value.toLowerCase())))

  const { updateResources } = useService(ResourceServiceKey)
  async function update(files: InstanceResourcePack[]) {
    const absent = files.filter(f => !f.resource.metadata.modrinth)
    const versions = await clientModrinthV2.getProjectVersionsByHash(absent.map(a => a.resource.hash))
    const options = Object.entries(versions).map(([hash, version]) => {
      const f = files.find(f => f.resource.hash === hash)
      if (f && f.resource.hash) return { hash: f.resource.hash, metadata: { modrinth: { projectId: version.project_id, versionId: version.id } } }
      return undefined
    }).filter((v): v is any => !!v)
    if (options.length > 0) {
      console.log('update resource packs', options)
      updateResources(options)
    }
  }
  watch(enabled, update, { immediate: true })
  watch(disabled, update, { immediate: true })

  return {
    disabled: _disabled,
    enabled: _enabled,
    all: _all,
    loadingCached,
  }
}

export function useResourcePackSearch(runtime: Ref<InstanceData['runtime']>, _enabled: Ref<InstanceResourcePack[]>, _disabled: Ref<InstanceResourcePack[]>) {
  const keyword: Ref<string> = ref('')
  const modrinthCategories = ref([] as string[])
  const curseforgeCategory = ref(undefined as number | undefined)
  const { tab, disableCurseforge, disableLocal, disableModrinth } = useTabMarketFilter()

  const { loadMoreModrinth, loadingModrinth, canModrinthLoadMore, modrinth, modrinthError } = useModrinthSearch<ResourcePackProject>('resourcepack', keyword, ref([]), modrinthCategories, runtime)
  const { loadMoreCurseforge, loadingCurseforge, canCurseforgeLoadMore, curseforge, curseforgeError } = useCurseforgeSearch(12, keyword, ref([]), curseforgeCategory, runtime)
  const { enabled, disabled, all: filtered, loadingCached } = useLocalSearch(keyword, _enabled, _disabled)
  const loading = computed(() => loadingModrinth.value || loadingCached.value || loadingCurseforge.value)

  const all = useAggregateProjects(
    computed(() => disableModrinth.value ? [] : modrinth.value),
    computed(() => disableCurseforge.value ? [] : curseforge.value),
    computed(() => disableLocal.value ? [] : filtered.value),
    computed(() => enabled.value.filter(v => v.title.toLowerCase().includes(keyword.value.toLowerCase()))),
  )

  const networkFirst = computed(() => !keyword.value && (modrinthCategories.value.length > 0 || curseforgeCategory.value !== undefined))
  const items = useProjectsFilterSearch(
    keyword,
    all,
    networkFirst,
  )

  return {
    items,
    tab,

    modrinthCategories,

    loadMoreModrinth,
    canModrinthLoadMore,
    modrinthError,
    modrinth,
    loadingModrinth,

    curseforgeCategory,
    loadMoreCurseforge,
    loadingCurseforge,
    canCurseforgeLoadMore,
    curseforge,
    curseforgeError,

    enabled,
    disabled,
    local: filtered,
    loadingCached,
    keyword,
    loading,
  }
}
