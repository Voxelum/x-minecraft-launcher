import { injection } from '@/util/inject'
import { Collection, Project } from '@xmcl/modrinth'
import { Mod as CurseforgeMod } from '@xmcl/curseforge'
import { CollectionContentType } from '@xmcl/runtime-api'
import { kSWRVConfig } from './swrvConfig'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { ProjectEntry } from '@/util/search'
import { getSWRV } from '@/util/swrvGet';
import { SearchModel } from './search'
import { kLocalCollections, parseLocalSelectionId, useLocalCollections } from './localCollections'

const PROJECT_TYPE_TO_CONTENT: Record<string, CollectionContentType> = {
  mod: 'mods',
  resourcepack: 'resourcepacks',
  shader: 'shaderpacks',
}

export function useMarketCollectionSearch<T extends ProjectEntry<any>>(projectType: string, {
  keyword,
  source,
  selectedCollection,
}: SearchModel, collections: Ref<Collection[] | undefined>, follows: Ref<Project[] | undefined>) {
  const config = injection(kSWRVConfig)
  // NOTE: this composable is created inside the market Context's own setup(),
  // where inject() resolves against the PARENT provides and cannot see the
  // kLocalCollections that Context itself provides. Fall back to creating the
  // composable directly — it shares the same synced SharedState.
  const localCollectionsCtx = inject(kLocalCollections, undefined) ?? useLocalCollections()
  const contentType = PROJECT_TYPE_TO_CONTENT[projectType]

  function mapProject(i: Project): T {
    return markRaw({
      id: i.id,
      icon: i.icon_url,
      title: i.title,
      author: '',
      description: i.description,
      downloadCount: i.downloads,
      followerCount: i.followers,
      modrinth: i,
      modrinthProjectId: i.id,
      installed: [] as any[],
    }) as unknown as T
  }

  function mapCurseforgeProject(i: CurseforgeMod): T {
    return markRaw({
      id: i.id.toString(),
      icon: i.logo?.url ?? '',
      title: i.name,
      author: i.authors?.[0]?.name ?? '',
      description: i.summary,
      downloadCount: i.downloadCount,
      followerCount: i.thumbsUpCount,
      curseforge: i,
      curseforgeProjectId: i.id,
      installed: [] as any[],
    }) as unknown as T
  }

  function filter(i: Project) {
    if (i.project_type !== projectType) {
      return false
    }
    if (keyword.value && !i.title.toLowerCase().includes(keyword.value.toLowerCase())) {
      return false
    }
    return true
  }

  function filterByKeyword(title: string) {
    return !keyword.value || title.toLowerCase().includes(keyword.value.toLowerCase())
  }

  const isValidating = ref(false)

  /**
   * Load the projects of a launcher-owned local collection for this content
   * type. Modrinth and CurseForge entries are fetched from their respective
   * clients; this works fully offline from the account point of view.
   */
  async function getLocalProjects(localId: string): Promise<T[]> {
    if (!contentType || !localCollectionsCtx) return []
    const collection = localCollectionsCtx.getCollection(localId)
    if (!collection) return []
    const entries = collection[contentType]
    if (entries.length === 0) return []

    const modrinthIds = entries.filter((e) => e.provider === 'modrinth').map((e) => e.projectId)
    const curseforgeIds = entries.filter((e) => e.provider === 'curseforge')
      .map((e) => Number(e.projectId)).filter((n) => Number.isInteger(n))

    const [modrinthProjects, curseforgeProjects] = await Promise.all([
      modrinthIds.length
        ? getSWRV({
          key: `/collections/local/${localId}/${contentType}/modrinth?ids=${[...modrinthIds].sort().join(',')}`,
          fetcher: () => clientModrinthV2.getProjects(modrinthIds),
        }, config).catch(() => [] as Project[])
        : Promise.resolve([] as Project[]),
      curseforgeIds.length
        ? getSWRV({
          key: `/collections/local/${localId}/${contentType}/curseforge?ids=${[...curseforgeIds].sort().join(',')}`,
          fetcher: () => clientCurseforgeV1.getMods(curseforgeIds),
        }, config).catch(() => [] as CurseforgeMod[])
        : Promise.resolve([] as CurseforgeMod[]),
    ])

    return [
      ...modrinthProjects.filter((i) => filterByKeyword(i.title)).map(mapProject),
      ...curseforgeProjects.filter((i) => filterByKeyword(i.name)).map(mapCurseforgeProject),
    ]
  }

  async function getProjects(id: string | undefined, follows: Project[] | undefined, collections: Collection[] | undefined) {
    isValidating.value = true
    try {
      const localId = parseLocalSelectionId(id)
      if (localId !== undefined) {
        return await getLocalProjects(localId)
      }
      if (id === 'followed' || !id) {
        return follows?.filter(filter).map(mapProject) || []
      }
      if (!collections) {
        return []
      }
      const coll = collections.find((i) => i.id === id)
      if (coll) {
        if (coll.projects.length === 0) {
          return []
        }
        // Include sorted project IDs in cache key to invalidate cache when collection content changes
        const projectsKey = [...coll.projects].sort().join(',')
        const result = await getSWRV({
          key: `/collections/${coll.id}?projects=${projectsKey}`,
          fetcher: () => clientModrinthV2.getProjects(coll.projects),
        }, config)
        return result.filter(filter).map(mapProject)
      }

      return []
    } finally {
      isValidating.value = false
    }
  }

  const items = ref([] as T[])

  function effect() {
    const localState = computed(() => localCollectionsCtx?.state.value)
    watch([source, selectedCollection, follows, collections, localState], async ([source, id, follows, collections]) => {
      if (source !== 'favorite') {
        return
      }
      items.value = await getProjects(id, follows, collections)
    }, { immediate: true, deep: true })
  }

  return {
    items,
    effect,
    isValidating,
  }
}
