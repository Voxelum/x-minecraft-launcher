import { ModsSearchSortField } from '@xmcl/curseforge'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { normalizeMarketSort, useMarketSort } from './marketSort'

describe('market sorting', () => {
  it.each([
    ['relevance', ModsSearchSortField.Popularity],
    ['downloads', ModsSearchSortField.TotalDownloads],
    ['follows', ModsSearchSortField.Popularity],
    ['updated', ModsSearchSortField.LastUpdated],
    ['newest', ModsSearchSortField.ReleasedDate],
  ] as const)('applies %s before the first search', (sort, curseforge) => {
    const result = useMarketSort(ref(sort))
    expect(result.modrinthSort.value).toBe(sort)
    expect(result.curseforgeSort.value).toBe(curseforge)
  })

  it.each([
    ['popularity', 'follows'], ['created', 'newest'],
    ['0', 'relevance'], ['1', 'downloads'], ['2', 'follows'], ['3', 'updated'], ['4', 'newest'],
    [0, 'relevance'], [1, 'downloads'], [2, 'follows'], [3, 'updated'], [4, 'newest'],
    ['', 'downloads'],
  ])('normalizes legacy value %s', (input, expected) => {
    expect(normalizeMarketSort(input)).toBe(expected)
  })

  it('updates both providers synchronously when the selection changes', () => {
    const sort = ref('downloads')
    const result = useMarketSort(sort)
    sort.value = 'newest'
    expect(result.modrinthSort.value).toBe('newest')
    expect(result.curseforgeSort.value).toBe(ModsSearchSortField.ReleasedDate)
  })
})
