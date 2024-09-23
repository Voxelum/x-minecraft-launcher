import { clientModrinthV2 } from '@/util/clients'
import { ProjectEntry } from '@/util/search'
import { InstanceData, ResourceServiceKey } from '@xmcl/runtime-api'
import { InjectionKey, Ref } from 'vue'
import { CurseforgeBuiltinClassId } from './curseforge'
import { useCurseforgeSearch } from './curseforgeSearch'
import { InstanceResourcePack } from './instanceResourcePack'
import { useMarketSort } from './marketSort'
import { useModrinthSearch } from './modrinthSearch'
import { searlizers, useQueryOverride } from './query'
import { useService } from './service'
import { useAggregateProjectsSplitted, useProjectsFilterSort } from './useAggregateProjects'

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
      const name = m.name.startsWith('file/') ? m.name.slice(5) : m.name
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

  function effect() {
    watch(enabled, update, { immediate: true })
    watch(disabled, update, { immediate: true })
  }

  return {
    disabled: _disabled,
    enabled: _enabled,
    all: _all,
    loadingCached,
    effect,
  }
}

export function useResourcePackSearch(runtime: Ref<InstanceData['runtime']>, _enabled: Ref<InstanceResourcePack[]>, _disabled: Ref<InstanceResourcePack[]>, enabledSet: Ref<Set<string>>) {
  const keyword = ref('')
  const gameVersion = ref('')
  const modrinthCategories = ref([] as string[])
  const curseforgeCategory = ref(undefined as number | undefined)
  const sort = ref(0)
  const isCurseforgeActive = ref(true)
  const isModrinthActive = ref(true)

  const { modrinthSort, curseforgeSort } = useMarketSort(sort)

  const { loadMoreModrinth, loadingModrinth, modrinth, modrinthError, effect: modrinthEffect } = useModrinthSearch<ResourcePackProject>('resourcepack', keyword, ref([]), modrinthCategories,
    modrinthSort, gameVersion)
  const { loadMoreCurseforge, loadingCurseforge, curseforge, curseforgeError, effect: curseforgeEffect } = useCurseforgeSearch(CurseforgeBuiltinClassId.resourcePack, keyword, ref([]), curseforgeCategory,
    curseforgeSort, gameVersion)
  const { enabled, disabled, all: filtered, loadingCached, effect: localEffect } = useLocalSearch(keyword, _enabled, _disabled)
  const loading = computed(() => loadingModrinth.value || loadingCached.value || loadingCurseforge.value)

  const {
    installed,
    notInstalledButCached,
    others,
  } = useAggregateProjectsSplitted(
    modrinth,
    curseforge,
    filtered,
    enabled,
  )

  const networkOnly = computed(() => modrinthCategories.value.length > 0 || curseforgeCategory.value !== undefined)

  const _installed = useProjectsFilterSort(
    keyword,
    installed,
    networkOnly,
    isCurseforgeActive,
    isModrinthActive,
  )
  const _notInstalledButCached = useProjectsFilterSort(
    keyword,
    notInstalledButCached,
    networkOnly,
    isCurseforgeActive,
    isModrinthActive,
  )
  const _others = useProjectsFilterSort(
    keyword,
    others,
    networkOnly,
    isCurseforgeActive,
    isModrinthActive,
  )

  function effect() {
    modrinthEffect()
    curseforgeEffect()
    localEffect()

    useQueryOverride('keyword', keyword, '', searlizers.string)
    useQueryOverride('gameVersion', gameVersion, computed(() => runtime.value.minecraft), searlizers.string)
    useQueryOverride('modLoaders', modrinthCategories, [], searlizers.stringArray)
    useQueryOverride('curseforgeCategory', curseforgeCategory, undefined, searlizers.number)
    useQueryOverride('sort', sort, 0, searlizers.number)
    useQueryOverride('curseforgeActive', isCurseforgeActive, true, searlizers.boolean)
    useQueryOverride('modrinthActive', isModrinthActive, true, searlizers.boolean)
  }

  return {
    networkOnly,
    sort,
    gameVersion,

    modrinthCategories,

    loadMoreModrinth,
    modrinthError,
    modrinth,
    loadingModrinth,

    curseforgeCategory,
    loadMoreCurseforge,
    loadingCurseforge,
    curseforge,
    curseforgeError,

    enabled: _installed,
    disabled: _notInstalledButCached,
    others: _others,
    local: filtered,
    loadingCached,
    keyword,
    loading,
    isCurseforgeActive,
    isModrinthActive,

    effect,
  }
}
