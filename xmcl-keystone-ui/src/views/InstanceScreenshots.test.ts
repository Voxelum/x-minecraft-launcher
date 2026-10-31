import { readFileSync } from 'node:fs'
import { compileScript, parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Vue from 'vue'
import { kDialogModel, useDialog, type DialogModel } from '../composables/dialog'

// Execute the real manager SFC setup. Only IPC/data and DOM boundaries are replaced.
const source = readFileSync(new URL('./InstanceScreenshots.vue', import.meta.url), 'utf8')
const script = compileScript(parse(source).descriptor, { id: 'screenshots-dialog-test' })
const compiled = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function mountManager() {
  const focus = vi.fn()
  class FocusTarget {
    isConnected = true
    focus = focus
  }
  const opener = new FocusTarget()
  for (const [name, value] of Object.entries(Vue)) vi.stubGlobal(name, value)
  vi.stubGlobal('HTMLElement', FocusTarget)
  vi.stubGlobal('document', { activeElement: opener })
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }))
  const route = Vue.ref('/base-setting')
  const push = vi.fn()
  vi.stubGlobal('useRouter', () => ({ currentRoute: route, push }))
  const disposeDrop = vi.fn()
  const registerHandler = vi.fn(() => disposeDrop)
  const manager = {
    items: Vue.ref([]), filteredItems: Vue.ref([]), selectedUrls: Vue.ref(new Set()),
    isPreviewOpen: Vue.ref(false), importFiles: vi.fn(),
  }
  const model: DialogModel = { current: Vue.shallowRef({ dialog: '', parameter: undefined }), registered: {} }
  const modules: Record<string, unknown> = {
    vue: Vue,
    '@xmcl/runtime-api': {},
    '@/composables/dialog': { useDialog },
    '@/composables/instance': { kInstance: 'instance' },
    '@/composables/theme': { kTheme: 'theme' },
    '@/composables/instanceTheme': { kInstanceTheme: 'instanceTheme' },
    '@/composables/notifier': { useNotifier: () => ({ notify: vi.fn() }) },
    '@/composables/screenshotManager': { useScreenshotManagerContext: () => manager },
    '@/util/size': { getExpectedSize: () => '' },
    '@/composables/date': { useDateString: () => ({ getDateString: () => '' }) },
    '@/composables/service': { useService: () => ({ openDirectory: vi.fn() }) },
    '@/util/inject': { injection: (key: unknown) => key === 'instance'
      ? { path: Vue.ref('test-instance') }
      : { dragover: Vue.ref(false), registerHandler } },
    '@/directives/sharedTooltip': {},
    '@/composables/dropHandler': { kDropHandler: 'drop', getDropFilePaths: () => [] },
  }
  const module = { exports: {} as { default: { setup: (props: object, ctx: object) => Record<string, any> } } }
  new Function('require', 'module', 'exports', compiled)((id: string) => {
    if (id.endsWith('.vue')) return {}
    if (!(id in modules)) throw new Error(`Unmocked dependency: ${id}`)
    return modules[id]
  }, module, module.exports)
  let state: Record<string, any>
  const Component = Vue.defineComponent({
    setup() {
      state = module.exports.default.setup({}, { expose() {} })
      return () => null
    },
  })
  const Root = Vue.defineComponent({
    setup() {
      Vue.provide(kDialogModel, model)
      return () => Vue.h(Component)
    },
  })
  const renderer = Vue.createRenderer<Record<string, never>, Record<string, never>>({
    patchProp() {}, insert() {}, remove() {}, createElement: () => ({}),
    createText: () => ({}), createComment: () => ({}), setText() {},
    setElementText() {}, parentNode: () => null, nextSibling: () => null,
  })
  const app = renderer.createApp(Root)
  app.mount({})
  return { state: state!, model, route, push, focus, opener, registerHandler, disposeDrop, app }
}

afterEach(() => vi.unstubAllGlobals())

describe('screenshots manager dialog', () => {
  it('reopens without navigation and restores focus while limiting drop handling to the open dialog', async () => {
    const ctx = mountManager()
    try {
      expect(ctx.registerHandler).not.toHaveBeenCalled()
      for (let index = 0; index < 2; index++) {
        ctx.model.current.value = { dialog: 'screenshots', parameter: undefined }
        await Vue.nextTick()
        expect(ctx.state.isShown.value).toBe(true)
        expect(ctx.registerHandler).toHaveBeenCalledTimes(index + 1)
        ctx.state.isShown.value = false // v-dialog model update: Escape/scrim/close
        await Vue.nextTick()
        await Vue.nextTick()
        expect(ctx.model.current.value.dialog).toBe('')
        expect(ctx.disposeDrop).toHaveBeenCalledTimes(index + 1)
        expect(ctx.focus).toHaveBeenCalledTimes(index + 1)
      }
      expect(ctx.route.value).toBe('/base-setting')
      expect(ctx.push).not.toHaveBeenCalled()
    } finally { ctx.app.unmount() }
  })

  it('does not focus an opener removed while the dialog was open', async () => {
    const ctx = mountManager()
    try {
      ctx.model.current.value = { dialog: 'screenshots', parameter: undefined }
      await Vue.nextTick()
      ctx.opener.isConnected = false
      ctx.state.isShown.value = false
      await Vue.nextTick()
      await Vue.nextTick()
      expect(ctx.focus).not.toHaveBeenCalled()
    } finally { ctx.app.unmount() }
  })
})
