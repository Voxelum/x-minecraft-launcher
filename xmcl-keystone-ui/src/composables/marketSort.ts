import { ModsSearchSortField } from '@xmcl/curseforge'

export function useMarketSort() {
  const modrinthSort = ref(undefined as 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated' | undefined)
  const curseforgeSort = ref(undefined as ModsSearchSortField | undefined)
  const set = (i: number) => {
    if (i === 0) {
      modrinthSort.value = 'relevance'
      curseforgeSort.value = ModsSearchSortField.Name
    } else if (i === 1) {
      modrinthSort.value = 'downloads'
      curseforgeSort.value = ModsSearchSortField.TotalDownloads
    } else if (i === 2) {
      modrinthSort.value = 'follows'
      curseforgeSort.value = ModsSearchSortField.Popularity
    } else if (i === 3) {
      modrinthSort.value = 'updated'
      curseforgeSort.value = ModsSearchSortField.LastUpdated
    } else if (i === 4) {
      modrinthSort.value = 'newest'
      curseforgeSort.value = ModsSearchSortField.LastUpdated
    }
  }
  const sort = ref(0)
  watch(sort, set)
  return {
    sort,
    modrinthSort,
    curseforgeSort,
  }
}
