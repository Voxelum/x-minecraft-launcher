import { describe, expect, it } from 'vitest'
import { reorderCardIds, updateInstanceState } from './homeCards'

describe('reorderCardIds', () => {
  it('inserts a card before the hovered card when moving down', () => {
    expect(reorderCardIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'a', 'c'])
  })

  it('inserts a card before the hovered card when moving up', () => {
    expect(reorderCardIds(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
  })

  it('preserves the original array for invalid moves', () => {
    const ids = ['a', 'b']
    expect(reorderCardIds(ids, 'missing', 'b')).toBe(ids)
    expect(reorderCardIds(ids, 'a', 'a')).toBe(ids)
  })
})

describe('updateInstanceState', () => {
  it('updates only the selected instance', () => {
    const states = {
      first: { hidden: false },
      second: { hidden: true },
    }

    expect(updateInstanceState(states, 'first', (current) => ({ hidden: !current?.hidden }))).toEqual({
      first: { hidden: true },
      second: { hidden: true },
    })
  })
})
