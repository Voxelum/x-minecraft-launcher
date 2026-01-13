import { CategoryChipProps } from '@/components/CategoryChip.vue'
import { ExploreProject } from '@/components/StoreExploreCard.vue'
import { CurseforgeBuiltinClassId, useCurseforge } from '@/composables/curseforge'
import { useDateString } from '@/composables/date'
import { getFeedTheBeastProjectModel, useFeedTheBeast } from '@/composables/ftb'
import { useMarketSort } from '@/composables/marketSort'
import { kModrinthTags, useModrinth } from '@/composables/modrinth'
import { useService } from '@/composables/service'
import { getCursforgeModLoadersFromString } from '@/util/curseforge'
import { injection } from '@/util/inject'
import { getExpectedSize } from '@/util/size'
import { mergeSorted } from '@/util/sort'
import { getSWRV } from '@/util/swrvGet'
import { ProjectMappingServiceKey } from '@xmcl/runtime-api'
import { Ref, computed, ref, watch } from 'vue'
import { kSWRVConfig } from './swrvConfig'

interface UseSearchedItemsOptions {
  query: Ref<string>
  gameVersion: Ref<string>
  modLoaders: Ref<string[]>
  sort: Ref<string>
  page: Ref<number>
  sources: Ref<string[]>
  modrinthCategories: Ref<Array<any>>
  curseforgeCategory: Ref<number | undefined>
  pageSize: number
  tCategory: (key: string) => string
}

export function useSearchedItems(options: UseSearchedItemsOptions) {
  const {
    query,
    gameVersion,
    modLoaders,
    sort,
    page,
    sources,
    modrinthCategories,
    curseforgeCategory,
    pageSize,
    tCategory,
  } = options

  const { t } = useI18n()
  const { getDateString } = useDateString()
  const { lookupBatch } = useService(ProjectMappingServiceKey)
  const { modrinthSort, curseforgeSort } = useMarketSort(sort)
  const config = injection(kSWRVConfig)
  const { categories: modrinthCategoriesMap } = injection(kModrinthTags)

  // FTB
  const { refreshing: ftbLoading, data: ftbData } = useFeedTheBeast(reactive({ keyword: query }))

  // FTB
  const ftbItems = shallowRef([] as ExploreProject[])
  watch([ftbData, page], async ([packs, pageNum]) => {
    if (!packs) {
      ftbItems.value = []
      return
    }
    if (!('packs' in packs)) {
      ftbItems.value = []
      return
    }

    // each page show 5 items
    const offset = (pageNum - 1) * 5

    const result = await Promise.all(packs.packs.slice(offset, offset + 5).map(async (p: any) => {
      const data = await getSWRV(getFeedTheBeastProjectModel(ref(p)), config)
      const result: ExploreProject = {
        id: p.toString(),
        type: 'ftb',
        title: data?.name ?? '',
        icon_url: data?.art.find((v: any) => v.type === 'square')?.url ?? '',
        description: data?.synopsis || '',
        author: data?.authors[0]?.name ?? '',
        labels: [
          { icon: 'file_download', text: getExpectedSize(data?.installs ?? 0, ''), id: `${data?.id}_download_icon` },
          { icon: 'event', text: getDateString((data?.released ?? 0) * 1000), id: `${data?.id}_event_icon` },
          { icon: 'edit', text: getDateString((data?.refreshed ?? 0) * 1000), id: `${data?.id}_edit_icon` },
          { icon: 'local_offer', text: data?.plays.toString() ?? '0', id: `${data?.id}_local_offer` },
        ],
        tags: data?.tags.map((t: any) => ({ text: t.name, id: t.id.toString() })) ?? [],
        gallery: data?.art.map((a: any) => a.url) ?? [],
      }
      return result
    }))

    ftbItems.value = result
  }, { immediate: true })

  // Modrinth
  const {
    error: searchError,
    refreshing: isModrinthSearching,
    projects,
    pageCount,
  } = useModrinth(
    query,
    gameVersion,
    '',
    modrinthCategories,
    modLoaders,
    '',
    modrinthSort,
    'modpack',
    page,
    pageSize,
  )

  // Curseforge
  const { projects: curseforgeProjects, isValidating: isCurseforgeSearching } = useCurseforge(
    CurseforgeBuiltinClassId.modpack,
    query,
    page,
    computed(() => getCursforgeModLoadersFromString(modLoaders.value)),
    curseforgeCategory,
    curseforgeSort,
    gameVersion,
    pageSize,
  )

  // Mappings for search results
  const mappings = ref<Record<string, { name: string; description: string }>>({})

  watch([projects, curseforgeProjects], async ([modrinthProjects, cfProjects]) => {
    const modrinthIds = modrinthProjects.map(p => p.project_id)
    const curseforgeIds = cfProjects.map(p => p.id)

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

    mappings.value = newMappings
  }, { immediate: true })

  const items = computed(() => {
    const modrinths = projects.value.map((p) => {
      const mapping = mappings.value[`modrinth:${p.project_id}`]
      const mapped: ExploreProject = {
        id: p.project_id,
        type: 'modrinth',
        title: p.title,
        icon_url: p.icon_url,
        description: p.description,
        author: p.author,
        labels: [
          { icon: 'file_download', text: getExpectedSize(p.downloads, ''), id: `${p.project_id}_download_icon` },
          { icon: 'event', text: getDateString(p.date_created), id: `${p.project_id}_created_icon` },
          { icon: 'edit', text: getDateString(p.date_modified), id: `${p.project_id}_modified_icon` },
          { icon: 'local_offer', text: p.versions[p.versions.length - 1], id: `${p.project_id}_local_offer` },
        ],
        tags: p.categories.map(c => ({ icon: modrinthCategoriesMap.value.find(cat => cat.name === c)?.icon, text: t(`modrinth.categories.${c}`, c), id: '' })),
        gallery: p.gallery,
        localizedTitle: mapping?.name,
        localizedDescription: mapping?.description,
      }
      return mapped
    })
    const curseforges = curseforgeProjects.value.map((p) => {
      const mapping = mappings.value[`curseforge:${p.id}`]
      const existed = new Set<number>()
      const tags = p.categories.map(c => {
        if (existed.has(c.id)) return undefined
        existed.add(c.id)
        return { icon: c.iconUrl, text: tCategory(c.name), id: c.id.toString() } as CategoryChipProps
      }).filter((v): v is CategoryChipProps => v !== undefined)
      const mapped: ExploreProject = {
        id: p.id.toString(),
        type: 'curseforge',
        title: p.name,
        icon_url: p.logo?.thumbnailUrl ?? '',
        description: p.summary,
        author: p.authors[0]?.name ?? '',
        labels: [
          { icon: 'file_download', text: getExpectedSize(p.downloadCount, ''), id: `${p.id}_download_icon` },
          { icon: 'event', text: getDateString(p.dateModified), id: `${p.id}_event_icon` },
          { icon: 'edit', text: getDateString(p.dateModified), id: `${p.id}_edit_icon` },
          { icon: 'local_offer', text: p.latestFilesIndexes[0].gameVersion, id: `${p.id}_local_offer` },
        ],
        tags,
        gallery: p.screenshots.map(s => s?.thumbnailUrl || ''),
        localizedTitle: mapping?.name,
        localizedDescription: mapping?.description,
      }
      return mapped
    })

    let filteredModrinths = modrinths
    let filteredCurseforges = curseforges
    let filteredFtb = ftbItems.value

    if (sources.value.length > 0) {
      if (!sources.value.includes('modrinth')) {
        filteredModrinths = []
      }
      if (!sources.value.includes('curseforge')) {
        filteredCurseforges = []
      }
      if (!sources.value.includes('ftb')) {
        filteredFtb = []
      }
    }

    if (curseforgeCategory.value && modrinthCategories.value.length === 0) {
      return filteredCurseforges
    }
    if (modrinthCategories.value.length > 0 && curseforgeCategory.value === undefined) {
      return filteredModrinths
    }

    return mergeSorted(mergeSorted(filteredModrinths, filteredFtb), filteredCurseforges)
  })

  const isSearching = computed(() => isModrinthSearching.value || isCurseforgeSearching.value || ftbLoading.value)

  return {
    items,
    isSearching,
    searchError,
    pageCount,
  }
}
