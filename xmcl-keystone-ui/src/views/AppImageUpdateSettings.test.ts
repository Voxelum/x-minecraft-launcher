import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { ModuleKind, transpileModule } from 'typescript'

const source = readFileSync(new URL('./AppImageUpdateSettings.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const compiled = transpileModule(compileScript(descriptor, {
  id: 'appimage-update-settings-test', inlineTemplate: true,
}).content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText

function harness(env = 'appimage', mode = 'external') {
  const updates: Array<(value: any) => void> = []
  const stub = vue.defineComponent({ setup: (_, { attrs, slots }) => () => {
    if (typeof attrs['onUpdate:modelValue'] === 'function') updates.push(attrs['onUpdate:modelValue'] as (value: any) => void)
    return vue.h('div', {}, [attrs.label as string, ...Object.values(slots).flatMap(slot => slot?.())])
  } })
  const state = vue.ref({
    appImageUpdateMode: mode, autoDownload: false, autoInstallOnAppQuit: false,
    appImageUpdateModeSet: vi.fn(), autoDownloadSet: vi.fn(), autoInstallOnAppQuitSet: vi.fn(),
  })
  const t = (key: string) => key
  const load = (name: string) => {
    if (name === 'vue') return vue
    if (name === 'vue-i18n') return { useI18n: () => ({ t }) }
    if (name === '@/composables/environment') return { kEnvironment: 'environment' }
    if (name === '@/composables/setting') return { kSettingsState: 'settings' }
    if (name === '@/util/inject') return { injection: (key: string) => key === 'environment' ? vue.ref({ env }) : { state } }
    throw new Error(`Unexpected dependency ${name}`)
  }
  const exports: { default?: vue.Component } = {}
  new Function('require', 'exports', compiled)(load, exports)
  const render = () => {
    const app = vue.createSSRApp(exports.default!)
    for (const name of ['VSelect', 'VAlert', 'VCheckbox']) app.component(name, stub)
    return renderToString(app)
  }
  return { state, render, updates }
}

describe('AppImage update ownership UI', () => {
  it('shows external default and forwards an explicit ownership selection', async () => {
    const { state, render, updates } = harness()
    const html = await render()
    expect(html).toContain('setting.appImageExternalUpdateHint')
    expect(html).not.toContain('setting.appImageAutoDownload')
    updates[0]('self-managed')
    expect(state.value.appImageUpdateModeSet).toHaveBeenCalledWith('self-managed')
  })
  it('shows self-managed requirements and independent automatic-update preferences', async () => {
    const { state, render, updates } = harness('appimage', 'self-managed')
    const html = await render()
    expect(html).toContain('setting.appImageSelfUpdateHint')
    expect(html).toContain('setting.appImageAutoDownload')
    expect(html).toContain('setting.appImageAutoInstall')
    updates[1](true)
    updates[2](false)
    expect(state.value.autoDownloadSet).toHaveBeenCalledWith(true)
    expect(state.value.autoInstallOnAppQuitSet).toHaveBeenCalledWith(false)
  })
  it('does not expose AppImage settings for other distributions', async () => {
    expect(await harness('raw').render()).not.toContain('setting.appImageUpdateMode')
  })
})
