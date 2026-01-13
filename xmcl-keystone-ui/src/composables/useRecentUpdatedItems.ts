import { useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { getFacatsText } from '@/composables/modrinth'
import { useService } from '@/composables/service'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { mergeSorted } from '@/util/sort'
import { ModsSearchSortField } from '@xmcl/curseforge'
import { ProjectMappingServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref, computed, inject, watch } from 'vue'

export function useRecentUpdatedItems(galleryMappings: Ref<Record<string, { name: string; description: string }>>) {
  const { t } = useI18n()
  const tCategory = useCurseforgeCategoryI18n()

  const { lookupBatch } = useService(ProjectMappingServiceKey)

  // Recent updated
  const { data: modrinthRecent, error: errorRecent, isValidating: isValidatingRecent } = useSWRV('/modrinth/recent_update', async () => {
    const result = await clientModrinthV2.searchProjects({
      index: 'updated',
      limit: 24,
      facets: getFacatsText('', '', [], [], 'modpack', ''),
    })
    return result.hits
  }, inject(kSWRVConfig))
  const { data: curseforgeRecent } = useSWRV('/curseforge/recent_update', async () => {
    const result = await clientCurseforgeV1.searchMods({
      sortField: ModsSearchSortField.LastUpdated,
      classId: 4471,
      pageSize: 30,
    })
    return result.data
  }, inject(kSWRVConfig))

  // Fetch mappings for recent updated items
  watch([modrinthRecent, curseforgeRecent], async ([modrinthItems, cfItems]) => {
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
  }, { immediate: true })

  const recentUpdatedItems = computed(() => {
    const recent = modrinthRecent.value || []
    const cfRecent = curseforgeRecent.value || []

    return mergeSorted(
      recent.map((r) => {
        const mapping = galleryMappings.value[`modrinth:${r.project_id}`]
        return {
          title: r.title,
          id: r.project_id,
          type: 'modrinth',
          logo: r.icon_url,
          description: r.description,
          updatedAt: r.date_modified,
          follows: r.follows,
          downloads: r.downloads,
          categories: r.categories.map(c => t(`modrinth.categories.${c}`, c)),
          localizedTitle: mapping?.name,
          localizedDescription: mapping?.description,
        }
      }),
      cfRecent.map((r) => {
        const mapping = galleryMappings.value[`curseforge:${r.id}`]
        return {
          id: r.id.toString(),
          type: 'curseforge',
          title: r.name,
          logo: r.logo?.thumbnailUrl ?? '',
          description: r.summary,
          updatedAt: r.dateModified,
          follows: r.downloadCount,
          downloads: r.downloadCount,
          categories: r.categories.map(c => tCategory(c.name)),
          localizedTitle: mapping?.name,
          localizedDescription: mapping?.description,
        }
      }),
    )
  })

  return { recentUpdatedItems, error: errorRecent, isValidating: isValidatingRecent }
}