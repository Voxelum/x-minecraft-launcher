import { clientModrinthV2 } from '@/util/clients'
import { ProjectEntry } from '@/util/search'
import { SearchResult } from '@xmcl/modrinth'
import { InstanceData } from '@xmcl/runtime-api'
import debounce from 'lodash.debounce'
import { Ref } from 'vue'

export function useModrinthSearch<T extends ProjectEntry<any>>(projectType: string,
  keyword: Ref<string>,
  passiveCategories: Ref<string[]>,
  activeCategories: Ref<string[]>,
  sort: Ref<'relevance' | 'downloads' | 'follows' | 'newest' | 'updated' | undefined>,
  gameVersion: Ref<string>,
) {
  const modrinth = ref(undefined as SearchResult | undefined)
  const modrinthError = ref(undefined as any)
  const loadingModrinth = ref(false)
  const modrinthPage = ref(0)

  const doSearch = debounce(async (offset: number, append: boolean) => {
    if (keyword.value || activeCategories.value.length > 0) {
      try {
        modrinthError.value = undefined
        const facets = [`["versions:${gameVersion.value}"]`, `["project_type:${projectType}"]`]
        if (passiveCategories.value.length > 0) {
          facets.push('[' + passiveCategories.value.map(m => `"categories:${m}"`).join(', ') + ']')
        }
        if (activeCategories.value.length > 0) {
          facets.push('[' + activeCategories.value.map(m => `"categories:${m}"`).join(', ') + ']')
        }
        const index = sort.value
        const result = await clientModrinthV2.searchProjects({
          query: keyword.value,
          facets: '[' + facets.join(',') + ']',
          index,
          offset,
          limit: 20,
        })
        if (!append || !modrinth.value) {
          modrinth.value = result
        } else {
          modrinth.value.hits.push(...result.hits)
          modrinth.value.limit += result.limit
          modrinth.value.offset = result.offset
        }
      } catch (e) {
        modrinthError.value = e
      } finally {
        loadingModrinth.value = false
      }
    } else {
      modrinthError.value = undefined
      modrinth.value = undefined
      loadingModrinth.value = false
    }
  }, 1000)

  const loadMoreModrinth = async () => {
    if (!modrinth.value) return
    const hasMore = modrinth.value.total_hits >= (modrinth.value.offset + modrinth.value.limit)
    if (!hasMore) return
    modrinthPage.value += 1
    loadingModrinth.value = true
    await doSearch(modrinthPage.value * 20, true)
  }

  const onSearch = async () => {
    // if (!isActive.value) return
    loadingModrinth.value = true
    modrinthPage.value = 0
    doSearch(modrinthPage.value * 20, false)
  }

  watch(keyword, onSearch)
  watch(activeCategories, onSearch, { deep: true })
  watch(sort, onSearch)

  const result = computed(() => {
    const modr = modrinth.value
    if (!modr) return []
    const projects: T[] = markRaw(modr.hits.map(i => ({
      id: i.project_id,
      icon: i.icon_url,
      title: i.title,
      author: i.author,
      description: i.description,
      downloadCount: i.downloads,
      followerCount: i.follows,
      modrinth: i,
      installed: [] as any[],
    }) as T))
    return projects
  })

  return {
    modrinth: result,
    modrinthError,
    loadMoreModrinth,
    loadingModrinth,
  }
}
