import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import { ModuleKind, transpileModule } from 'typescript'
import { afterEach, expect, test, vi } from 'vitest'
import { computed, effectScope, nextTick, ref, type ComputedRef, type Ref } from 'vue'
import * as vue from 'vue'

const source = readFileSync(new URL('./SaveDetail.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(source)
if (errors.length) throw errors[0]
const compiled = transpileModule(compileScript(descriptor, { id: 'save-detail-test' }).content, {
  compilerOptions: { module: ModuleKind.CommonJS },
}).outputText
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
})

function mount() {
  const progress = ref<{ quests?: { chapters: { id: string }[] } }>()
  const instanceKey = Symbol('instance')
  const saveKey = Symbol('save')
  const modules: Record<string, unknown> = {
    vue,
    '@/components/MarketProjectDetail.vue': {},
    '@/components/MarketProjectDetailContentSave.vue': {},
    '@/components/SaveWorldMap.vue': {},
    '@/components/SaveProgress.vue': {},
    '@/composables/date': { useDateString: () => ({ getDateString: String }) },
    '@/composables/instance': { kInstance: instanceKey },
    '@/composables/instanceSave': { kInstanceSave: saveKey },
    '@/composables/instanceSaveProgress': {
      useInstanceSaveProgress: () => ({ progress, loading: ref(false), error: ref(), refresh: vi.fn() }),
    },
    '@/util/inject': {
      injection: (key: symbol) => {
        if (key === instanceKey) return { path: ref('instance'), instance: ref({ version: '1.21.1', runtime: {} }) }
        if (key === saveKey) return { enableSave: vi.fn(), disableSave: vi.fn() }
        throw new Error(`Unexpected injection ${String(key)}`)
      },
    },
  }
  const exports: {
    default?: {
      setup: (props: object, context: object) => {
        currentTab: Ref<'progress' | 'map'>
        progressCategory: ComputedRef<'quests' | 'advancements'>
      }
    }
  } = {}
  const load = (name: string) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name}`)
    return modules[name]
  }
  new Function('require', 'exports', 'computed', 'ref', 'useI18n', compiled)(
    load, exports, computed, ref, () => ({ t: String }),
  )
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => exports.default!.setup(
    { save: { installed: [{ path: 'save' }] } },
    { expose: () => {}, emit: () => {} },
  ))!
  return { state, progress }
}

test('keeps the selected progress tab stable while async quest data changes its category', async () => {
  const { state, progress } = mount()
  expect(state.currentTab.value).toBe('progress')
  expect(state.progressCategory.value).toBe('advancements')
  progress.value = { quests: { chapters: [{ id: 'chapter' }] } }
  await nextTick()
  expect(state.currentTab.value).toBe('progress')
  expect(state.progressCategory.value).toBe('quests')
  progress.value = undefined
  await nextTick()
  expect(state.currentTab.value).toBe('progress')
  expect(state.progressCategory.value).toBe('advancements')
  expect(descriptor.template?.content).toContain('<v-tab value="progress">')
  expect(descriptor.template?.content).toContain(':category="progressCategory"')
})

test('preserves the world map selection when progress refreshes', async () => {
  const { state, progress } = mount()
  state.currentTab.value = 'map'
  progress.value = { quests: { chapters: [{ id: 'chapter' }] } }
  await nextTick()
  expect(state.currentTab.value).toBe('map')
})
