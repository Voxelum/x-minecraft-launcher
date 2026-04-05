import { describe, expect, test } from 'vitest'
import { getSelectableGameVersionIds, isSelectableGameVersion } from './gameVersion'

describe('gameVersion', () => {
  test('accepts modern release ids including 26.1', () => {
    expect(isSelectableGameVersion('1.21.11')).toBe(true)
    expect(isSelectableGameVersion('26.1')).toBe(true)
  })

  test('rejects snapshots and prereleases', () => {
    expect(isSelectableGameVersion('24w14a')).toBe(false)
    expect(isSelectableGameVersion('1.21-pre1')).toBe(false)
    expect(isSelectableGameVersion('1.21.6-rc1')).toBe(false)
  })

  test('keeps the current release visible even if metadata is stale', () => {
    expect(getSelectableGameVersionIds(['1.21.11', '1.21.10'], '26.1')).toEqual(['26.1', '1.21.11', '1.21.10'])
  })
})
