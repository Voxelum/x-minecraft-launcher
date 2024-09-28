import { ModsSearchSortField } from '@xmcl/curseforge'
import { Ref } from 'vue'

export function useMarketSort<V extends number | string = number>(sort: Ref<V>) {
  const modrinthSort = ref(undefined as 'relevance' | 'downloads' | 'follows' | 'newest' | 'updated' | undefined)
  const curseforgeSort = ref(undefined as ModsSearchSortField | undefined)
  const set = (i: V) => {
    if (i === 0 || i === 'relevance') {
      modrinthSort.value = 'relevance'
      curseforgeSort.value = ModsSearchSortField.Name
    } else if (i === 1 || i === 'downloads') {
      modrinthSort.value = 'downloads'
      curseforgeSort.value = ModsSearchSortField.TotalDownloads
    } else if (i === 2 || i === 'follows') {
      modrinthSort.value = 'follows'
      curseforgeSort.value = ModsSearchSortField.Popularity
    } else if (i === 3 || i === 'updated') {
      modrinthSort.value = 'updated'
      curseforgeSort.value = ModsSearchSortField.LastUpdated
    } else if (i === 4 || i === 'newest') {
      modrinthSort.value = 'newest'
      curseforgeSort.value = ModsSearchSortField.LastUpdated
    } else {
      modrinthSort.value = 'downloads'
      curseforgeSort.value = ModsSearchSortField.TotalDownloads
    }
  }
  watch(sort, (nv) => set(nv as V))
  return {
    sort,
    modrinthSort,
    curseforgeSort,
  }
}
