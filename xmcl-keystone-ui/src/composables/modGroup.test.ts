import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { getGroupDisplayName, useModGroups } from './modGroup'

// The mounted legacy-group migration is outside these tests.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref('en') }),
}))
vi.mock('vue', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue')>(),
  onMounted: vi.fn(),
}))

const mocks = vi.hoisted(() => ({ state: undefined as any, updateModsGroups: vi.fn() }))
vi.mock('./service', () => ({ useService: () => ({ updateModsGroups: mocks.updateModsGroups }) }))
vi.mock('./syncableState', () => ({ useState: () => ({ state: mocks.state }) }))

const scopes: ReturnType<typeof effectScope>[] = []
let storage: Map<string, string>

function setup(path = ref('/instance-a'), contentType: 'mods' | 'resourcepacks' | 'shaderpacks' = 'mods', items = ref([] as any[])) {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useModGroups(ref(true), path, items, ref('name'), contentType))!
}

beforeEach(() => {
  storage = new Map()
  mocks.state = ref({ groups: { Performance: { files: ['sodium.jar'], color: '' }, Visuals: { files: ['iris.jar'], color: '' } } })
  mocks.updateModsGroups.mockImplementation((path: string, groups: any) => {
    if (mocks.state.value) mocks.state.value.groups = groups
  })
  mocks.updateModsGroups.mockClear()
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key, locale: ref('en') }))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
})

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})

describe('collapse all mod groups', () => {
  it('collapses expanded, collapsed and implicit groups in one reactive update without modifying group membership', async () => {
    const groups = setup()
    groups.groupCollapsedState.value = { Performance: false, Unrelated: false }
    const previous = groups.groupCollapsedState.value
    groups.collapseAllGroups()
    expect(groups.groupCollapsedState.value).toEqual({ Performance: true, Visuals: true, Unrelated: false })
    expect(previous).toEqual({ Performance: false, Unrelated: false })
    expect(mocks.updateModsGroups).not.toHaveBeenCalled()
    await nextTick()
    expect(JSON.parse(storage.get('modsGroupsCollapsed:/instance-a')!)).toEqual(groups.groupCollapsedState.value)
    groups.collapseAllGroups()
    expect(groups.groupCollapsedState.value.Visuals).toBe(true)
    groups.toggleGroupCollapsed('Visuals')
    expect(groups.groupCollapsedState.value.Visuals).toBe(false)
  })

  it('does not write a queued collapse to the next instance when switching immediately', async () => {
    const path = ref('/instance-a')
    const groups = setup(path)
    groups.collapseAllGroups()
    path.value = '/instance-b'
    await nextTick()
    expect(groups.groupCollapsedState.value).toEqual({})
    expect(JSON.parse(storage.get('modsGroupsCollapsed:/instance-a')!)).toEqual({ Performance: true, Visuals: true })
  })

  it('handles no groups without inventing entries', () => {
    mocks.state.value.groups = {}
    const groups = setup()
    groups.collapseAllGroups()
    expect(groups.groupCollapsedState.value).toEqual({})
  })

  it('restores collapsed state on remount and keeps instance and content-type state isolated', async () => {
    const path = ref('/instance-a')
    const groups = setup(path)
    groups.collapseAllGroups()
    await nextTick()
    expect(setup().groupCollapsedState.value).toEqual({ Performance: true, Visuals: true })
    expect(setup(ref('/instance-a'), 'resourcepacks').groupCollapsedState.value).toEqual({})
    expect(setup(ref('/instance-a'), 'shaderpacks').groupCollapsedState.value).toEqual({})

    path.value = '/instance-b'
    await nextTick()
    expect(groups.groupCollapsedState.value).toEqual({})
    groups.toggleGroupCollapsed('Performance')
    await nextTick()
    expect(JSON.parse(storage.get('modsGroupsCollapsed:/instance-a')!)).toEqual({ Performance: true, Visuals: true })
    expect(JSON.parse(storage.get('modsGroupsCollapsed:/instance-b')!)).toEqual({ Performance: true })

    path.value = '/instance-a'
    await nextTick()
    expect(groups.groupCollapsedState.value).toEqual({ Performance: true, Visuals: true })
  })
})

describe('autoCategorizeMods', () => {
  it('preserves existing assignments for mods outside the filtered search subset', () => {
    mocks.state.value.groups = {
      'modCategory.optimization': { files: ['sodium.jar'], color: '' },
      CustomFolder: { files: ['unrelated-hidden.jar'], color: '#123456' },
    }
    const filteredItems = ref([
      {
        id: 'lithium',
        title: 'Lithium',
        installed: [{ fileName: 'lithium.jar' }],
      },
    ])
    const groups = setup(ref('/instance-a'), 'mods', filteredItems as any)
    const count = groups.autoCategorizeMods()

    expect(count).toBe(1)
    // CustomFolder should still have unrelated-hidden.jar
    expect(groups.groupsRaw.value.CustomFolder).toEqual({
      files: ['unrelated-hidden.jar'],
      color: '#123456',
    })
    // modCategory.optimization should still have sodium.jar and now also lithium.jar
    expect(groups.groupsRaw.value['modCategory.optimization'].files).toContain('sodium.jar')
    expect(groups.groupsRaw.value['modCategory.optimization'].files).toContain('lithium.jar')
  })

  it('does not wipe out groups when filtered items list is empty', () => {
    mocks.state.value.groups = {
      'modCategory.optimization': { files: ['sodium.jar'], color: '' },
      PinnedGroup: { files: [], pinned: true, color: '' },
      EmptyFolder: { files: [], color: '#123456', icon: 'star' },
    }
    const original = JSON.parse(JSON.stringify(mocks.state.value.groups))
    const emptyItems = ref([] as any[])
    const groups = setup(ref('/instance-a'), 'mods', emptyItems)
    const count = groups.autoCategorizeMods()

    expect(count).toBe(0)
    expect(groups.groupsRaw.value['modCategory.optimization'].files).toEqual(['sodium.jar'])
    expect(groups.groupsRaw.value.PinnedGroup.pinned).toBe(true)
    expect(groups.groupsRaw.value).toEqual(original)
    expect(mocks.updateModsGroups).not.toHaveBeenCalled()
  })

  it('preserves empty folders and category metadata while normalizing disabled assignments', () => {
    mocks.state.value.groups = {
      OldFolder: { files: ['sodium.jar.disabled', 'hidden.jar'], color: '' },
      EmptyFolder: { files: [], color: '#123456', icon: 'star' },
      'modCategory.optimization': { files: ['lithium.jar'], color: '#ABCDEF', icon: 'favorite' },
    }
    const groups = setup(ref('/instance-a'), 'mods', ref([
      { id: 'sodium', title: 'Sodium', installed: [{ fileName: 'sodium.jar.disabled' }] },
      { id: 'lithium', title: 'Lithium', installed: [{ fileName: 'lithium.jar' }] },
    ]))
    expect(groups.autoCategorizeMods()).toBe(2)
    expect(groups.groupsRaw.value.OldFolder.files).toEqual(['hidden.jar'])
    expect(groups.groupsRaw.value.EmptyFolder).toEqual({ files: [], color: '#123456', icon: 'star' })
    expect(groups.groupsRaw.value['modCategory.optimization']).toEqual({
      files: ['sodium.jar', 'lithium.jar'], color: '#ABCDEF', icon: 'favorite',
    })
  })

  it('persists stable category IDs and localizes group menu labels after a locale switch', () => {
    const locale = ref('de')
    vi.stubGlobal('useI18n', () => ({ t: (key: string) => key, locale }))
    mocks.state.value.groups = {}
    const project = { id: 'sodium', title: 'Sodium', installed: [{ fileName: 'sodium.jar' }] }
    const groups = setup(ref('/instance-a'), 'mods', ref([project]))
    groups.autoCategorizeMods()
    expect(groups.groups.value).toEqual(['modCategory.optimization'])

    const menuLabel = () => groups.getContextMenuItemsForGroup(project as any).find(item => item.children)?.children?.[0].text
    expect(menuLabel()).toBe('Optimierung & Leistung')
    locale.value = 'en'
    expect(menuLabel()).toBe('Optimization & Performance')
    expect(groups.groups.value).toEqual(['modCategory.optimization'])
  })
})

describe('getGroupDisplayName', () => {
  it('translates previously persisted localized category names as well as stable IDs', () => {
    const t = (key: string) => key
    expect(getGroupDisplayName('Optimierung & Leistung', t, 'en')).toBe('Optimization & Performance')
    expect(getGroupDisplayName('modCategory.optimization', t, 'de')).toBe('Optimierung & Leistung')
    expect(getGroupDisplayName('My custom folder', t, 'de')).toBe('My custom folder')
  })
})
