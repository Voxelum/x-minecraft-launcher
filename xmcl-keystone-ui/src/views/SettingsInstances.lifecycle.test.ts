import { EventEmitter } from 'node:events'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { ModuleKind, transpileModule } from 'typescript'
import { InstanceState } from '@xmcl/runtime-api'
import { kInstances, useInstances } from '../composables/instances'
import { useInstanceEdit } from '../composables/instanceEdit'
import { injection } from '../util/inject'

const service = vi.hoisted(() => ({ current: {} as any }))
vi.mock('../composables/service', () => ({ useService: () => service.current }))
vi.mock('../composables/user', () => ({ kUserContext: Symbol('user') }))
vi.mock('../composables/launchButton', () => ({ kLaunchButton: Symbol('launch') }))
vi.mock('../composables/setting', () => ({
  useGlobalSettings: () => new Proxy({}, { get: (_, key) => vue.ref(key === 'globalVmOptions' || key === 'globalMcOptions' ? [] : undefined) }),
}))
vi.mock('@vueuse/core', async (original) => ({
  ...await original<typeof import('@vueuse/core')>(),
  useLocalStorage: () => vue.ref('/instance'),
}))

// Run the actual view setups/lifecycle, without needing Vuetify or a DOM.
function view(name: string) {
  const { descriptor } = parse(readFileSync(new URL(name, import.meta.url), 'utf8'))
  const compiled = transpileModule(compileScript(descriptor, { id: name }).content, {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText
  const load = (id: string): any => {
    if (id === 'vue') return vue
    if (id === 'vue-i18n') return { useI18n: () => ({ t: (key: string) => key }) }
    if (id.endsWith('/instances')) return { kInstances, useInstances }
    if (id.endsWith('/inject')) return { injection }
    if (id.endsWith('/service')) return { useService: () => service.current }
    if (id.endsWith('/backup')) return { useBackup: () => ({ loadAutoBackupState: vi.fn(), backupProgress: vue.ref(null), isCreating: vue.ref(false), autoBackupConfig: vue.ref(null), autoBackupFiles: vue.ref([]) }) }
    if (id.endsWith('/dialog')) return { useDialog: () => ({ isShown: vue.ref(false), hide: vi.fn(), show: vi.fn() }) }
    if (id.endsWith('/notifier')) return { useNotifier: () => ({ notify: vi.fn() }) }
    if (id === '@/constant') return { BuiltinImages: {} }
    if (id === '@xmcl/runtime-api') return { BaseServiceKey: 'base' }
    if (id.endsWith('.vue')) return { default: {} }
    throw new Error(`Unexpected dependency ${id}`)
  }
  const exports: { default?: vue.ComponentOptions } = {}
  new Function('require', 'exports', compiled)(load, exports)
  return { ...exports.default, render: () => null }
}

const renderer = vue.createRenderer<any, any>({
  createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert: () => {}, remove: () => {}, setText: () => {}, setElementText: () => {},
  parentNode: () => null, nextSibling: () => null, patchProp: () => {},
})

async function settle() {
  for (let i = 0; i < 10; i++) await vue.nextTick()
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('settings instance subscription lifetime (#1834)', () => {
  it.each(['./SettingBackup.vue', './BackupCreateDialog.vue'])(
    'keeps Java edits synchronized after leaving %s', async (name) => {
      vi.useFakeTimers()
      for (const key of ['ref', 'computed', 'reactive', 'watch', 'markRaw'] as const) vi.stubGlobal(key, vue[key])
      vi.stubGlobal('document', new EventTarget())
      vi.stubGlobal('window', new EventTarget())

      // Real main-process tracking: repeated fetches track the same window only
      // once; any unref from a child would stop its commit broadcasts.
      const applyEdit = InstanceState.prototype.instanceEdit
      class MainState extends InstanceState {
        override instanceEdit(payload: Parameters<InstanceState['instanceEdit']>[0]) { applyEdit.call(this, payload) }
      }
      const main = new MainState()
      main.instanceAdd({ path: '/instance', name: 'Test', runtime: { minecraft: '1.21' }, java: '/java/old' } as any)
      // Load the main-process fixture through Vitest's runtime alias so its
      // separate tsconfig (~/*) does not leak into the renderer typecheck.
      const { ServiceStateContainer } = await vi.importActual<any>('~/service/ServiceStateContainer')
      const container = new ServiceStateContainer('instances', vi.fn(), { instance: main })
      const events = new EventEmitter()
      const client = Object.assign(new EventEmitter(), {
        isDestroyed: () => false,
        send: (channel: string, _id: string, type: string, payload: any) => {
          if (channel === 'commit') events.emit('mutation', type, payload)
        },
      })
      const shared = Object.assign(JSON.parse(JSON.stringify(main)), {
        subscribeAll: (fn: any) => events.on('mutation', fn),
        unsubscribeAll: (fn: any) => events.off('mutation', fn),
        subscribe: () => {}, unsubscribe: () => {},
        unref: vi.fn(() => container.untrack(client)),
        revalidate: vi.fn(), commit: vi.fn(),
      })
      const getState = vi.fn(async () => { container.track(client); return shared })
      service.current = {
        getSharedInstancesState: getState,
        validateInstancePath: async () => undefined,
        editInstance: async ({ instancePath, ...payload }: any) => main.instanceEdit({ path: instancePath, ...payload }),
      }
      const showSettings = vue.ref(true)
      const SettingsView = view(name)
      let rootInstances!: ReturnType<typeof useInstances>
      let editor!: ReturnType<typeof useInstanceEdit>
      const Editor = vue.defineComponent({ setup() {
        // Instance editing needs only the root launch button's flush hook.
        editor = useInstanceEdit(vue.computed(() => rootInstances.instances.value[0]), rootInstances.edit)
        return () => null
      } })
      // Supply the launch hook using the same key as the real composable.
      const { kLaunchButton } = await import('../composables/launchButton')
      const app = renderer.createApp({ setup() {
        rootInstances = useInstances()
        vue.provide(kInstances, rootInstances)
        vue.provide(kLaunchButton, { usePreclickListener: () => {} } as any)
        return () => showSettings.value ? vue.h(SettingsView) : vue.h(Editor)
      } })
      try {
        const { kUserContext } = await import('../composables/user')
        app.provide(kUserContext, {} as any)
        app.mount({})
        await settle()
        showSettings.value = false
        await settle()
        editor.javaPath.value = '/java/new'
        await vi.advanceTimersByTimeAsync(2000)
        await settle()
        expect(main.instances[0].java).toBe('/java/new')
        expect(rootInstances.instances.value[0].java).toBe('/java/new')
        expect(editor.javaPath.value).toBe('/java/new')
        expect(shared.unref).not.toHaveBeenCalled()
        expect(getState).toHaveBeenCalledTimes(1)
      } finally {
        app.unmount()
        container.destroy()
      }
      expect(shared.unref).toHaveBeenCalledTimes(1)
    },
  )
})
