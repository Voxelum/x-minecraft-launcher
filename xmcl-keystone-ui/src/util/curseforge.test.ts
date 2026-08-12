import { describe, expect, it } from 'vitest'
import { mergeCurseforgeFilePage } from './curseforge'

describe(mergeCurseforgeFilePage.name, () => {
  it('replaces the version list with the first page', () => {
    expect(mergeCurseforgeFilePage(['stale'], ['latest', 'stable'], 0)).toEqual([
      'latest',
      'stable',
    ])
  })

  it('appends subsequent version pages without duplicating refreshed entries', () => {
    expect(mergeCurseforgeFilePage(['a', 'b', 'old'], ['c', 'd'], 2)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ])
  })
})