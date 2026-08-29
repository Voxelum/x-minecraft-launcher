import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { clearSearch } from './marketTextField'

describe('clearSearch', () => {
  it('clears the keyword and emits clear', () => {
    const keyword = ref('iris')
    const emit = vi.fn()

    clearSearch(keyword, emit)

    expect(keyword.value).toBe('')
    expect(emit).toHaveBeenCalledWith('clear')
  })
})
