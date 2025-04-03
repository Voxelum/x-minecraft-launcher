import { injection } from '@/util/inject'
import { Collection, Project } from '@xmcl/modrinth'
import { kSWRVConfig } from './swrvConfig'
import { clientModrinthV2 } from '@/util/clients'
import { ProjectEntry } from '@/util/search'
import { getSWRV } from '@/util/swrvGet';
import { SearchModel } from './search'

export function useMarketCollectionSearch<T extends ProjectEntry<any>>(projectType: string, {
  keyword,
  source,
  selectedCollection,
}: SearchModel, collections: Ref<Collection[] | undefined>, follows: Ref<Project[] | undefined>) {
  const config = injection(kSWRVConfig)

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

  function filter(i: Project) {
    if (i.project_type !== projectType) {
      return false
    }
    if (keyword.value && !i.title.toLowerCase().includes(keyword.value.toLowerCase())) {
      return false
    }
    return true
  }

  const isValidating = ref(false)
  async function getProjects(id: string | undefined, follows: Project[] | undefined, collections: Collection[] | undefined) {
    isValidating.value = true
    try {
      if (id === 'followed' || !id) {
        return follows?.filter(filter).map(mapProject) || []
      }
      if (!collections) {
        return []
      }
      const coll = collections.find((i) => i.id === id)
      if (coll) {
        const result = await getSWRV({
          key: `/collections/${coll.id}`,
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
    watch([source, selectedCollection, follows, collections], async ([source, id, follows, collections]) => {
      if (source !== 'favorite') {
        return
      }
      // @ts-expect-error
      items.value = await getProjects(id, follows, collections)
    }, { immediate: true })
  }

  return {
    items,
    effect,
    isValidating,
  }
}
