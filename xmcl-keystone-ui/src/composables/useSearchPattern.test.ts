import { describe, expect, it, vi } from 'vitest'
import { useSearchPattern } from './useSearchPattern'

describe('useSearchPattern', () => {
  it('correctly calculates hasMore using offset and limit instead of data length', async () => {
    const searchMock = vi.fn().mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
      total: 10,
      offset: 0,
      limit: 2,
    })

    const { onSearch, hasMore, loadMore, result, page } = useSearchPattern(searchMock, () => true, 2)
    await onSearch()

    expect(result.value?.data.length).toBe(2)
    expect(hasMore.value).toBe(true)

    // Second page succeeds
    searchMock.mockResolvedValueOnce({
      data: [{ id: 3 }, { id: 4 }],
      total: 10,
      offset: 2,
      limit: 2,
    })
    await loadMore()
    expect(page.value).toBe(1)
    expect(hasMore.value).toBe(true)

    // Last page reached: total: 4, offset: 2, limit: 2 => offset + limit >= total
    searchMock.mockResolvedValueOnce({
      data: [{ id: 5 }],
      total: 5,
      offset: 4,
      limit: 2,
    })
    await loadMore()
    expect(hasMore.value).toBe(false)
  })

  it('does not advance page when loadMore request fails', async () => {
    const searchMock = vi.fn().mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
      total: 10,
      offset: 0,
      limit: 2,
    })

    const { onSearch, loadMore, page, hasMore } = useSearchPattern(searchMock, () => true, 2)
    await onSearch()
    expect(page.value).toBe(0)
    expect(hasMore.value).toBe(true)

    // Next page fails
    searchMock.mockRejectedValueOnce(new Error('Network error'))
    await loadMore()
    // Page should still be 0 so it can be retried
    expect(page.value).toBe(0)
  })
})
