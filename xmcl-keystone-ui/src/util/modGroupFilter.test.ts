import { describe, expect, it } from 'vitest'
import { flattenVisibleModGroups, isProjectInModGroup } from './modGroupFilter'

function project(id: string) {
  return { id } as any
}

describe(flattenVisibleModGroups.name, () => {
  it('omits a group when none of its projects match', () => {
    const hidden = project('hidden')
    const group = { name: 'group', projects: [hidden], mtime: 0 }

    expect(flattenVisibleModGroups([group], () => false, {})).toEqual([])
  })

  it('keeps the group and only its matching projects when expanded', () => {
    const visible = project('visible')
    const hidden = project('hidden')
    const group = { name: 'group', projects: [visible, hidden], mtime: 0 }

    expect(flattenVisibleModGroups(
      [group],
      item => item.id === 'visible',
      {},
    )).toEqual([group, visible])
  })

  it('keeps a matching collapsed group without rendering its projects', () => {
    const visible = project('visible')
    const group = { name: 'group', projects: [visible], mtime: 0 }

    expect(flattenVisibleModGroups([group], () => true, { group: true })).toEqual([group])
  })
})

describe(isProjectInModGroup.name, () => {
  const group = { name: 'group', projects: [project('first'), project('second')], mtime: 0 }

  it('finds a selected project in the group', () => {
    expect(isProjectInModGroup(group, 'second')).toBe(true)
  })

  it('rejects missing and unrelated selected projects', () => {
    expect(isProjectInModGroup(group, 'other')).toBe(false)
    expect(isProjectInModGroup(group, undefined)).toBe(false)
  })
})