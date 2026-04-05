import { useService } from './service'
import { InstanceModsServiceKey } from '@xmcl/runtime-api'
import { ref, watch, shallowRef } from 'vue'
import type { Ref } from 'vue'

export interface SpotlightModResult {
  id: string
  type: 'modrinth'
  title: string
  iconUrl: string
  description: string
  author: string
  downloadCount: string
  slug: string
}

interface LocalModResult {
  id: string
  title: string
  description: string
  icon: string | undefined
  files: any[]
  installed: any[]
  modrinthProjectId?: string
  curseforgeProjectId?: number
}

export function useSpotlightSearch(
  query: Ref<string>,
  gameVersion: Ref<string | undefined>,
  modLoader: Ref<string | undefined>,
) {
  const modResults = shallowRef<SpotlightModResult[]>([])
  const localModResults = shallowRef<LocalModResult[]>([])
  const isSearching = ref(false)

  // Search mods from Modrinth filtered by game version & loader
  watch([query, gameVersion, modLoader], async ([newQuery, gv, ml]) => {
    if (!newQuery || newQuery.trim().length < 2) {
      modResults.value = []
      return
    }

    // Don't search if no game version or no mod loader (vanilla instance)
    if (!gv || !ml) {
      modResults.value = []
      return
    }

    isSearching.value = true
    const searchQuery = newQuery.trim()

    try {
      const results = await searchModrinthMods(searchQuery, gv, ml)
      modResults.value = results.slice(0, 8)
    } finally {
      isSearching.value = false
    }
  }, { immediate: true })

  // Search local mods
  watch(query, async (newQuery) => {
    if (!newQuery || newQuery.trim().length < 2) {
      localModResults.value = []
      return
    }

    const searchQuery = newQuery.trim().toLowerCase()

    const { searchInstalled } = useService(InstanceModsServiceKey)
    try {
      const results = await searchInstalled(searchQuery)
      localModResults.value = results.map((mod: any) => ({
        id: mod.modrinth?.projectId || mod.curseforge?.projectId?.toString() || mod.name,
        title: mod.name,
        description: mod.description || '',
        icon: mod.icon,
        files: [mod],
        installed: [mod],
        modrinthProjectId: mod.modrinth?.projectId,
        curseforgeProjectId: mod.curseforge?.projectId,
      }))
    } catch (e) {
      console.error('Failed to search local mods:', e)
      localModResults.value = []
    }
  }, { immediate: true })

  return {
    modResults,
    localModResults,
    isSearching,
  }
}

// Search Modrinth mods filtered by game version and loader
async function searchModrinthMods(query: string, gameVersion: string, loader: string): Promise<SpotlightModResult[]> {
  try {
    // Build facets: [[game version], [loader], [project_type]]
    const facets = JSON.stringify([
      [`versions:${gameVersion}`],
      [`categories:${loader}`],
      ['project_type:mod'],
    ])
    const url = `https://api.modrinth.com/v2/search?limit=8&index=relevance&query=${encodeURIComponent(query)}&facets=${encodeURIComponent(facets)}`
    const response = await fetch(url)
    if (!response.ok) return []

    const data = await response.json()
    return data.hits.map((hit: any) => ({
      id: hit.project_id,
      type: 'modrinth' as const,
      title: hit.title,
      iconUrl: hit.icon_url,
      description: hit.description,
      author: hit.author,
      downloadCount: formatNumber(hit.downloads),
      slug: hit.slug,
    }))
  } catch (e) {
    console.error('Failed to search Modrinth mods:', e)
    return []
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}
