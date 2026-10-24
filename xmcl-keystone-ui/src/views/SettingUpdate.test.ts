import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { ModuleKind, transpileModule } from 'typescript'
import type { UpdateCapability } from '@xmcl/runtime-api'
import { useUpdateCapability } from '../composables/updateCapability'

const source = readFileSync(new URL('./SettingUpdate.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const compiled = transpileModule(compileScript(descriptor, {
  id: 'setting-update-capability-test', inlineTemplate: true,
}).content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText

function harness() {
  const actions: Array<() => void> = []
  const stub = vue.defineComponent({ setup: (_, { attrs, slots }) => () => {
    if (typeof attrs.onClick === 'function') actions.push(attrs.onClick as () => void)
    return vue.h('div', Object.values(slots).flatMap(slot => slot?.()))
  } })
  const state = vue.shallowRef<{ updateCapability?: UpdateCapability }>()
  const check = vi.fn(async () => {})
  const capability = useUpdateCapability(state, check)
  const settings = {
    ...capability, updateInfo: vue.ref(null), installing: vue.ref(false),
    updateStatus: vue.ref('none'), version: vue.ref('0.66.2'),
  }
  const load = (name: string) => {
    if (name === 'vue') return vue
    if (name === 'vue-i18n') return { useI18n: () => ({ t: (key: string) => key }) }
    if (name === '@/directives/sharedTooltip') return { vSharedTooltip: { getSSRProps: () => ({}) } }
    if (name === '@/util/inject') return { injection: () => settings }
    if (name.endsWith('/dialog')) return { useDialog: () => ({ show: vi.fn() }) }
    if (name.endsWith('/setting')) return { kUpdateSettings: Symbol('settings') }
    if (name.endsWith('.vue')) return { default: stub }
    throw new Error(`Unexpected setting update dependency: ${name}`)
  }
  const exports: { default?: vue.Component } = {}
  new Function('require', 'exports', 'useI18n', compiled)(load, exports, () => ({ t: (key: string) => key }))
  const render = () => {
    const app = vue.createSSRApp(exports.default!)
    for (const name of ['VAlert', 'VBtn', 'VIcon', 'VChip', 'VProgressLinear']) app.component(name, stub)
    return renderToString(app)
  }
  return { state, check, capability, render, actions }
}

describe('settings update capability UI', () => {
  it('opens GitHub only when the user invokes the releases button', async () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    try {
      const { state, render, actions, capability } = harness()
      state.value = { updateCapability: { automatic: false, reason: 'not-implemented' } }
      await render()
      await capability.checkUpdate()
      expect(open).not.toHaveBeenCalled()
      const releaseClick = actions.find(action => action.name === 'openReleases')
      expect(releaseClick).toBeTypeOf('function')
      releaseClick!()
      expect(open).toHaveBeenCalledExactlyOnceWith('https://github.com/voxelum/x-minecraft-launcher/releases', 'browser')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('does not render already-latest before settings arrive, then renders unsupported instead of release controls', async () => {
    const { state, render, capability, check } = harness()
    expect(await render()).not.toContain('launcherUpdate.alreadyLatest')
    state.value = { updateCapability: { automatic: false, reason: 'not-implemented' } }
    const html = await render()
    expect(html).toContain('launcherUpdate.automaticUnavailable')
    expect(html).toContain('launcherUpdate.automaticNotImplemented')
    expect(html).toContain('setting.githubRelease')
    expect(html).not.toContain('launcherUpdate.alreadyLatest')
    expect(html).not.toContain('launcherUpdate.installAndQuit')
    await capability.checkUpdate()
    expect(await render()).toContain('launcherUpdate.manualCheckRequired')
    expect(capability.checkingUpdate.value).toBe(false)
    expect(check).not.toHaveBeenCalled()
  })

  it('keeps legacy Electron rendering and distinguishes not-configured capability', async () => {
    const { state, render } = harness()
    state.value = {}
    expect(await render()).toContain('launcherUpdate.alreadyLatest')
    state.value = { updateCapability: { automatic: false, reason: 'not-configured' } }
    expect(await render()).toContain('launcherUpdate.automaticNotConfigured')
    expect(await render()).not.toContain('launcherUpdate.alreadyLatest')
  })
})
