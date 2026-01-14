import { useCurseforgeCategoryI18n } from '@/composables/curseforge'
import { getFacatsText, kModrinthTags } from '@/composables/modrinth'
import { kSWRVConfig } from '@/composables/swrvConfig'
import { useService } from '@/composables/service'
import { clientCurseforgeV1, clientModrinthV2 } from '@/util/clients'
import { mergeSorted } from '@/util/sort'
import { ModsSearchSortField } from '@xmcl/curseforge'
import { ProjectMappingServiceKey } from '@xmcl/runtime-api'
import useSWRV from 'swrv'
import { Ref, computed, inject, watch } from 'vue'
import { injection } from '@/util/inject'

export function useRecentMinecraftItems(galleryMappings: Ref<Record<string, { name: string; description: string }>>) {
  const { t } = useI18n()
  const tCategory = useCurseforgeCategoryI18n()

  const { lookupBatch } = useService(ProjectMappingServiceKey)

  const { gameVersions } = injection(kModrinthTags)

  // Latest minecraft
  const latestModrinth = computed(() => gameVersions.value.filter(v => v.major)[0].version)
  const { data: modrinthRecentMinecraft } = useSWRV('/modrinth/recent_version', async () => {
    const result = await clientModrinthV2.searchProjects({
      index: 'newest',
      limit: 30,
      facets: getFacatsText(latestModrinth.value, '', [], [], 'modpack', ''),
    })
    return result.hits
  }, inject(kSWRVConfig))
  const { data: curseforgeRecentMinecraft } = useSWRV('/curseforge/recent_version', async () => {
    const result = await clientCurseforgeV1.searchMods({ sortField: ModsSearchSortField.GameVersion, classId: 4471, pageSize: 30 })
    return result.data
  }, inject(kSWRVConfig))

  // Fetch mappings for latest minecraft items
  watch([modrinthRecentMinecraft, curseforgeRecentMinecraft], async ([modrinthItems, cfItems]) => {
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

  const recentMinecraftItems = computed(() => {
    const modrinths = modrinthRecentMinecraft.value || []
    const curseforges = curseforgeRecentMinecraft.value || []

    return mergeSorted(
      modrinths.map((r) => {
        const mapping = galleryMappings.value[`modrinth:${r.project_id}`]
        return {
          title: r.title,
          type: 'modrinth' as const,
          id: r.project_id,
          image: r.icon_url || r.gallery[0],
          description: r.description,
          author: r.author,
          downloads: r.downloads,
          updatedAt: r.date_modified,
          gameVersion: latestModrinth.value,
          categories: r.categories.map(c => t(`modrinth.categories.${c}`, c)),
          localizedTitle: mapping?.name,
          localizedDescription: mapping?.description,
        }
      }),
      curseforges.map((r) => {
        const mapping = galleryMappings.value[`curseforge:${r.id}`]
        return {
          id: r.id.toString(),
          type: 'curseforge' as const,
          title: r.name,
          image: r.logo?.thumbnailUrl ?? '',
          description: r.summary,
          author: r.authors[0]?.name ?? '',
          downloads: r.downloadCount,
          updatedAt: r.dateModified,
          gameVersion: r.latestFilesIndexes[0]?.gameVersion,
          categories: r.categories.map(c => tCategory(c.name)),
          localizedTitle: mapping?.name,
          localizedDescription: mapping?.description,
        }
      }),
    )
  })

  return { recentMinecraftItems }
}
