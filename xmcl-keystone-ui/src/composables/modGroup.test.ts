import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { useModGroups } from './modGroup'

// These tests exercise collapse persistence, not the mounted legacy-group migration.
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

function setup(path = ref('/instance-a'), contentType: 'mods' | 'resourcepacks' | 'shaderpacks' = 'mods') {
  const scope = effectScope()
  scopes.push(scope)
  return scope.run(() => useModGroups(ref(true), path, ref([]), ref('name'), contentType))!
}

beforeEach(() => {
  storage = new Map()
  mocks.state = ref({ groups: { Performance: { files: ['sodium.jar'], color: '' }, Visuals: { files: ['iris.jar'], color: '' } } })
  mocks.updateModsGroups.mockClear()
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
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
