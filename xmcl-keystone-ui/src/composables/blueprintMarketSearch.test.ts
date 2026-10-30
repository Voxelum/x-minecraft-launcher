import { describe, expect, it, vi } from 'vitest'
import type { BlueprintMarketItem, BlueprintMarketSearchOptions, BlueprintMarketSearchResult } from '@xmcl/runtime-api'
import { useBlueprintMarketSearch } from './blueprintMarketSearch'

function harness() {
  const requests: { options: BlueprintMarketSearchOptions; resolve: (r: BlueprintMarketSearchResult) => void; reject: (e: Error) => void }[] = []
  const search = vi.fn((options: BlueprintMarketSearchOptions) => new Promise<BlueprintMarketSearchResult>((resolve, reject) => requests.push({ options, resolve, reject })))
  const report = vi.fn()
  const market = useBlueprintMarketSearch(['mcschematic'], search, report)
  const result = (id: string, hasMore = true): BlueprintMarketSearchResult => ({ items: [{ id } as BlueprintMarketItem], page: 0, hasMore })
  return { requests, market, result, report }
}

describe('blueprint market request ownership', () => {
  it('starts the latest keyword during loading and ignores late old results and finalizers', async () => {
    const { market, requests, result } = harness()
    const old = market.reset('')
    const latest = market.reset('house')
    expect(requests.map(r => r.options.keyword)).toEqual(['', 'house'])
    requests[0].resolve(result('old'))
    await old
    expect(market.loading.value).toBe(true)
    expect(market.items.value).toEqual([])
    requests[1].resolve(result('house'))
    await latest
    expect(market.items.value.map(i => i.id)).toEqual(['house'])
    expect(market.loading.value).toBe(false)
    const next = market.load()
    expect(requests[2].options).toMatchObject({ keyword: 'house', page: 1 })
    requests[2].resolve(result('page-two', false))
    await next
    await market.load()
    expect(requests).toHaveLength(3)
    expect(market.items.value.map(i => i.id)).toEqual(['house', 'page-two'])
  })
  it('does not append an old page after resetting or publish stale errors', async () => {
    const { market, requests, result, report } = harness()
    const first = market.reset('old')
    requests[0].resolve(result('first'))
    await first
    const oldPage = market.load()
    const fresh = market.reset('new')
    requests[2].resolve(result('new', false))
    await fresh
    requests[1].reject(new Error('old network failure'))
    await oldPage
    expect(market.items.value.map(i => i.id)).toEqual(['new'])
    expect(report).not.toHaveBeenCalledWith('Failed to search blueprint market.')
    expect(market.loading.value).toBe(false)
  })
  it('recovers loading and pagination after failure with a new search', async () => {
    const { market, requests, result, report } = harness()
    const failed = market.reset('bad')
    requests[0].reject(new Error('offline'))
    await failed
    expect(market.loading.value).toBe(false)
    expect(report).toHaveBeenLastCalledWith('Failed to search blueprint market.')
    const retry = market.reset('good')
    expect(report).toHaveBeenLastCalledWith('')
    expect(requests[1].options.page).toBe(0)
    requests[1].resolve(result('good', false))
    await retry
    expect(market.items.value[0].id).toBe('good')
  })
})
