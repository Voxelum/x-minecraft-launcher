import { ModsSearchSortField } from '@xmcl/curseforge'
import { computed, Ref } from 'vue'

export type MarketSort = 'relevance' | 'downloads' | 'follows' | 'updated' | 'newest'

export function normalizeMarketSort(sort: number | string): MarketSort {
  switch (sort) {
    case 0: case '0': case 'relevance': return 'relevance'
    case 2: case '2': case 'popularity': case 'follows': return 'follows'
    case 3: case '3': case 'updated': return 'updated'
    case 4: case '4': case 'created': case 'newest': return 'newest'
    default: return 'downloads'
  }
}

export function useMarketSort<V extends number | string = number>(sort: Ref<V>) {
  const modrinthSort = computed(() => normalizeMarketSort(sort.value))
  const curseforgeSort = computed(() => ({
    relevance: ModsSearchSortField.Popularity,
    downloads: ModsSearchSortField.TotalDownloads,
    follows: ModsSearchSortField.Popularity,
    updated: ModsSearchSortField.LastUpdated,
    newest: ModsSearchSortField.ReleasedDate,
  })[modrinthSort.value])
  return {
    sort,
    modrinthSort,
    curseforgeSort,
  }
}
