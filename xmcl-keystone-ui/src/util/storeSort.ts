import type { MarketSort } from '../composables/marketSort'
import { mergeSorted } from './sort'

export type StoreSource = 'modrinth' | 'curseforge' | 'ftb'

export interface StoreSortMetrics {
  downloads: number
  updated: number
  newest: number
}

export function getStoreSources(omitted: string[], modrinthCategories: string[], curseforgeCategory: number | undefined): StoreSource[] {
  const sources: StoreSource[] = curseforgeCategory && !modrinthCategories.length
    ? ['curseforge']
    : modrinthCategories.length && curseforgeCategory === undefined
      ? ['modrinth']
      : ['modrinth', 'curseforge', 'ftb']
  return sources.filter(source => !omitted.includes(source))
}

// Provider rankings are not comparable. Only merge numeric metrics across a page.
export function mergeStoreResults<T extends { sortMetrics: StoreSortMetrics }>(groups: T[][], sort: MarketSort): T[] {
  const items = groups.reduce((result, group) => mergeSorted(result, group), [])
  if (sort === 'relevance' || sort === 'follows') return items
  return items.sort((a, b) => b.sortMetrics[sort] - a.sortMetrics[sort])
}
