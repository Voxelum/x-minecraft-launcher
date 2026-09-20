import { describe, expect, it } from 'vitest'
import { getStoreSources, mergeStoreResults } from './storeSort'

describe('store sorting', () => {
  it('uses category restrictions as well as source exclusions', () => {
    expect(getStoreSources([], [], 42)).toEqual(['curseforge'])
    expect(getStoreSources([], ['adventure'], undefined)).toEqual(['modrinth'])
    expect(getStoreSources(['modrinth', 'ftb'], [], undefined)).toEqual(['curseforge'])
    expect(getStoreSources(['curseforge'], [], 42)).toEqual([])
    expect(getStoreSources([], ['adventure'], 42)).toEqual(['modrinth', 'curseforge', 'ftb'])
  })

  const a = { id: 'a', sortMetrics: { downloads: 900, updated: 300, newest: 100 } }
  const b = { id: 'b', sortMetrics: { downloads: 10000, updated: 100, newest: 300 } }
  const c = { id: 'c', sortMetrics: { downloads: 1000, updated: 200, newest: 200 } }
  it.each([
    ['downloads', ['b', 'c', 'a']],
    ['updated', ['a', 'c', 'b']],
    ['newest', ['b', 'c', 'a']],
  ] as const)('merges raw %s metrics rather than formatted labels', (sort, expected) => {
    const groups = [[a, c], [b]]
    expect(mergeStoreResults(groups, sort).map(item => item.id)).toEqual(expected)
    expect(groups).toEqual([[a, c], [b]])
  })

  it.each(['relevance', 'follows'] as const)('preserves provider rankings for %s', (sort) => {
    expect(mergeStoreResults([[a, c], [b]], sort)).toEqual([a, b, c])
  })
})
