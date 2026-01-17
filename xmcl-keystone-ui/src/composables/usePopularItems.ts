import { computed, ref, watch, type Ref } from 'vue'
import { useI18n } from 'vue-i18n-bridge'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { injection } from '@/util/inject'
import { mergeSorted } from '@/util/sort'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useService } from '@/composables/service'
import { useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { getFacatsText } from '@/composables/modrinth'
import { ProjectMappingServiceKey } from '@xmcl/runtime-api'
import { Mod, ModsSearchSortField } from '@xmcl/curseforge'
import { SearchResultHit } from '@xmcl/modrinth'
import useSWRV from 'swrv'
import { GameGallery } from '@/components/StoreGallery.vue'

export function usePopularItems(galleryMappings: Ref<Record<string, { name: string; description: string }>>) {
  const { t } = useI18n()
  const tCategory = useCurseforgeCategoryI18n()
  const { lookupBatch } = useService(ProjectMappingServiceKey)

  // Popular list API calls
  const { data: modrinthResult, error, isValidating } = useSWRV('/modrinth/featured', async () => {
    const result = await clientModrinthV2.searchProjects({
      index: 'follows',
      limit: 5,
      facets: getFacatsText('', '', [], [], 'modpack', ''),
    })
    return result.hits
  }, injection(kSWRVConfig))

  const { data: curseforgeResult, error: curseforgeError, isValidating: curseforgeValidating } = useSWRV('/curseforge/featured', async () => {
    const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.Featured, classId: 4471, pageSize: 5 })
    return result.data
  }, injection(kSWRVConfig))

  // Fetch mappings for popular items
  watch([modrinthResult, curseforgeResult], async ([modrinthItems, cfItems]) => {
    const modrinthIds = (modrinthItems || []).map(p => p.project_id)
    const curseforgeIds = (cfItems || []).map(p => p.id)

    const result = await lookupBatch(modrinthIds, curseforgeIds)
    const newMappings: Record<string, { name: string; description: string }> = {}

    for (const mapping of result) {
      if (mapping.modrinthId) {
        newMappings[`modrinth:${mapping.modrinthId}`] = {
          name: mapping.name,
          description: mapping.description,
        }
      }
      if (mapping.curseforgeId) {
        newMappings[`curseforge:${mapping.curseforgeId}`] = {
          name: mapping.name,
          description: mapping.description,
        }
      }
    }

    galleryMappings.value = { ...galleryMappings.value, ...newMappings }
  })

  const popularItems = computed(() => {
    function getGameGalleryFromModrinth(hits: SearchResultHit[]) {
      return hits.map((hit) => {
        const mapping = galleryMappings.value[`modrinth:${hit.project_id}`]
        const images = hit.gallery.map(g => [g, g]) as [string, string][]
        if (hit.icon_url) {
          images.push([hit.icon_url, hit.icon_url])
        }
        const game: GameGallery = {
          id: hit.project_id,
          title: hit.title,
          images,
          type: 'modrinth',
          developer: hit?.author ?? '',
          minecraft: hit?.versions ?? [],
          categories: hit.categories.map(c => t(`modrinth.categories.${c}`, c)),
          localizedTitle: mapping?.name,
        }
        return game
      })
    }

    function getGameGalleryFromCurseforge(mods: Mod[]) {
      return mods.map((p) => {
        const mapping = galleryMappings.value[`curseforge:${p.id}`]
        const images = p.screenshots.map(g => [g?.thumbnailUrl ?? '', g?.url ?? '']) as [string, string][]
        if (p.logo) {
          images.push([p.logo?.thumbnailUrl ?? '', p.logo?.url ?? ''])
        }
        const game: GameGallery = {
          id: p.id.toString(),
          title: p.name,
          images,
          type: 'curseforge',
          developer: p.authors[0]?.name ?? '',
          minecraft: p.latestFilesIndexes.map(f => f.gameVersion),
          categories: p.categories.map(c => tCategory(c.name)),
          localizedTitle: mapping?.name,
        }
        return game
      })
    }

    const modrinth = getGameGalleryFromModrinth(modrinthResult.value ?? [])
    const curseforge = getGameGalleryFromCurseforge(curseforgeResult.value ?? [])

    return mergeSorted(modrinth, curseforge)
  })

  return {
    popularItems,
    isLoading: computed(() => isValidating.value || curseforgeValidating.value),
    error: computed(() => error.value || curseforgeError.value)
  }
}