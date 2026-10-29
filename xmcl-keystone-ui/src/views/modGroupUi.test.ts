import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { getGroupDisplayName } from '../composables/modGroup'

const locale = Vue.ref('de')
const parameter = Vue.ref<any>()
const scopes: Vue.EffectScope[] = []

function setup(file: string, props = {}) {
  const descriptor = parse(readFileSync(new URL(file, import.meta.url), 'utf8')).descriptor
  const compiled = ts.transpileModule(compileScript(descriptor, { id: file }).content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const modules: Record<string, unknown> = {
    vue: Vue,
    '@/composables/dialog': { useDialog: () => ({ parameter, isShown: Vue.ref(true), show: vi.fn() }) },
    '@/composables/modGroup': { getGroupDisplayName },
    '@/directives/contextMenu': {},
    '@/directives/sharedTooltip': {},
  }
  const module = { exports: {} as any }
  new Function('require', 'module', 'exports', compiled)((id: string) => {
    if (!(id in modules)) throw new Error(`Unmocked dependency: ${id}`)
    return modules[id]
  }, module, module.exports)
  const scope = Vue.effectScope()
  scopes.push(scope)
  const emit = vi.fn()
  const state = scope.run(() => module.exports.default.setup(props, { expose: () => {}, emit }))
  return { state, emit }
}

beforeEach(() => {
  locale.value = 'de'
  parameter.value = undefined
  for (const [name, value] of Object.entries(Vue)) vi.stubGlobal(name, value)
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key, locale }))
})

afterEach(() => {
  scopes.splice(0).forEach(scope => scope.stop())
  vi.unstubAllGlobals()
})

describe('localized mod group controls', () => {
  it('searches translated folder labels but returns the persisted identity on selection', () => {
    const onSelect = vi.fn()
    parameter.value = {
      groups: {
        'modCategory.optimization': { files: [], color: '' },
        'Custom folder': { files: [], color: '' },
      },
      onSelect,
    }
    const { state } = setup('./ModGroupSelectDialog.vue')
    state.searchQuery.value = 'leistung'
    expect(state.filteredGroups.value.map(([id]: [string]) => id)).toEqual(['modCategory.optimization'])
    expect(state.displayName(state.filteredGroups.value[0][0])).toBe('Optimierung & Leistung')
    locale.value = 'en'
    expect(state.filteredGroups.value).toEqual([])
    state.searchQuery.value = 'performance'
    expect(state.filteredGroups.value.map(([id]: [string]) => id)).toEqual(['modCategory.optimization'])
    state.onSelectGroup(state.filteredGroups.value[0][0])
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('modCategory.optimization')
  })

  it('shows a translated settings name without renaming the category when changing its color or locale', async () => {
    const { state, emit } = setup('./ModGroupEntryItem.vue', {
      name: 'modCategory.optimization', items: [], color: '', icon: '', pinned: false,
    })
    expect(state.mutableState.name).toBe('Optimierung & Leistung')
    state.mutableState.color = '#123456'
    await Vue.nextTick()
    expect(emit).toHaveBeenLastCalledWith('setting', expect.objectContaining({ name: 'modCategory.optimization', color: '#123456' }))
    locale.value = 'en'
    await Vue.nextTick()
    expect(state.mutableState.name).toBe('Optimization & Performance')
    expect(emit).toHaveBeenLastCalledWith('setting', expect.objectContaining({ name: 'modCategory.optimization' }))
    state.mutableState.name = 'My custom group'
    await Vue.nextTick()
    expect(emit).toHaveBeenLastCalledWith('setting', expect.objectContaining({ name: 'My custom group' }))
  })
})
