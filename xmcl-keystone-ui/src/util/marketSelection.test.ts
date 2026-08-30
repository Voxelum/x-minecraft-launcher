import { describe, expect, it } from 'vitest'
import { isMarketMultiSelectionClick, updateMarketSelection } from './marketSelection'

const plainClick = { ctrlKey: false, metaKey: false, shiftKey: false }

describe(isMarketMultiSelectionClick.name, () => {
  it('enters selection mode for modifier clicks when enabled', () => {
    expect(isMarketMultiSelectionClick(false, true, { ...plainClick, ctrlKey: true })).toBe(true)
    expect(isMarketMultiSelectionClick(false, true, { ...plainClick, metaKey: true })).toBe(true)
    expect(isMarketMultiSelectionClick(false, true, { ...plainClick, shiftKey: true })).toBe(true)
  })

  it('keeps plain clicks in navigation mode until selection mode is active', () => {
    expect(isMarketMultiSelectionClick(false, true, plainClick)).toBe(false)
    expect(isMarketMultiSelectionClick(true, true, plainClick)).toBe(true)
  })
})

describe(updateMarketSelection.name, () => {
  const items = [{ id: 'first' }, { name: 'group' }, 'separator', { id: 'second' }, { id: 'third' }]

  it('toggles a control-clicked item and makes it the range anchor', () => {
    expect(updateMarketSelection(items, 'second', 'first', undefined, { first: true }, {
      ...plainClick,
      ctrlKey: true,
    })).toEqual({
      selections: { first: true, second: true },
      anchorId: 'second',
    })
  })

  it('selects the range from the previously selected item', () => {
    expect(updateMarketSelection(items, 'third', 'first', undefined, {}, {
      ...plainClick,
      shiftKey: true,
    })).toEqual({
      selections: { first: true, second: true, third: true },
      anchorId: 'first',
    })
  })

  it('adds a range for control-shift and meta-shift clicks', () => {
    const expected = {
      selections: { outside: true, second: true, third: true },
      anchorId: 'second',
    }
    expect(updateMarketSelection(items, 'third', undefined, 'second', { outside: true }, {
      ctrlKey: true,
      metaKey: false,
      shiftKey: true,
    })).toEqual(expected)
    expect(updateMarketSelection(items, 'third', undefined, 'second', { outside: true }, {
      ctrlKey: false,
      metaKey: true,
      shiftKey: true,
    })).toEqual(expected)
  })

  it('selects only the target when shift-clicking without a valid anchor', () => {
    expect(updateMarketSelection(items, 'second', undefined, undefined, { first: true }, {
      ...plainClick,
      shiftKey: true,
    })).toEqual({
      selections: { second: true },
      anchorId: 'second',
    })
  })
})