import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { ModuleKind, transpileModule } from 'typescript'
import * as date from '../util/date'

const source = readFileSync(new URL('./SaveProgressCanvas.vue', import.meta.url), 'utf8')
const { descriptor, errors } = parse(source)
if (errors.length) throw errors[0]
const script = compileScript(descriptor, { id: 'save-progress-canvas-test' })
const compiled = transpileModule(script.content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText
const exports: { default?: vue.Component } = {}
const load = (name: string) => {
  if (name === 'vue') return vue
  if (name === '@/util/date') return date
  throw new Error(`Unexpected canvas dependency: ${name}`)
}
new Function('require', 'exports', 'useI18n', compiled)(load, exports, () => ({ t: (key: string) => key }))

const renderScript = compileScript(descriptor, { id: 'save-progress-render-test', inlineTemplate: true })
const renderModule: { default?: vue.Component } = {}
new Function('require', 'exports', 'useI18n', transpileModule(renderScript.content, {
  compilerOptions: { module: ModuleKind.CommonJS },
}).outputText)(load, renderModule, () => ({ t: (key: string) => key }))

describe('save progress canvas initialization', () => {
  test.each(['advancements', 'quests'])('initializes populated %s before eager watchers run', async category => {
    const progress = {
      advancements: {
        items: [{ id: 'minecraft:story/root', title: 'Root', done: true }],
      },
      quests: {
        chapters: [{
          id: 'chapter',
          title: 'Chapter',
          completedQuests: 1,
          totalQuests: 1,
          quests: [{ id: '0001', title: 'Quest', done: true, dependencies: [], x: 0, y: 0 }],
        }],
      },
    }
    const component = { ...exports.default, render: () => null }
    const app = vue.createSSRApp(component, { progress, category })
    const errors: unknown[] = []
    app.config.errorHandler = error => { errors.push(error) }
    await renderToString(app)
    expect(errors).toEqual([])
  })

  test('renders named controls and keyboard-accessible quest states without stray text', async () => {
    const progress = {
      quests: {
        chapters: [{
          id: 'chapter', title: 'Chapter', completedQuests: 1, totalQuests: 2,
          quests: [
            { id: '0001', title: 'First', done: true, dependencies: [], x: 0, y: 0 },
            { id: '001F', title: 'Locked quest', done: false, locked: true, dependencies: ['001D'], x: 2, y: 0 },
          ],
        }],
      },
    }
    const app = vue.createSSRApp(renderModule.default!, { progress, category: 'quests' })
    for (const [name, tag] of Object.entries({
      VBtn: 'button', VBtnToggle: 'div', VIcon: 'span', VChip: 'span',
      VTextField: 'input', VTabs: 'div', VTab: 'button', VCard: 'div',
    })) {
      app.component(name, vue.defineComponent({ setup: (_, { attrs, slots }) => () => vue.h(tag, attrs, slots.default?.()) }))
    }
    const html = await renderToString(app)
    expect(html).toContain('aria-label="save.progress.zoomIn"')
    expect(html).toContain('aria-label="save.progress.zoomOut"')
    expect(html).toContain('aria-label="save.resetView"')
    expect(html).toContain('aria-label="save.progress.treeView"')
    expect(html).toContain('aria-label="instance.fullscreen"')
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-label="Locked quest: save.progress.locked"/)
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('First: save.progress.done')
    expect(html).not.toMatch(/>\s*-m\s*</)
  })

  test('keeps launcher chrome on shared surface and radius tokens, with wrapping controls', () => {
    const css = descriptor.styles.map(style => style.content).join('\n')
    expect(css).toMatch(/\.progress-root\s*\{[^}]*color: rgb\(var\(--v-theme-on-surface\)\)/)
    expect(css).toMatch(/\.progress-zoom\s*\{[^}]*border-radius: var\(--card-item-radius\)/)
    expect(css).toContain('max-width: calc(100cqw - 16px)')
    expect(css).toMatch(/@container \(max-width: 560px\)/)
    expect(source).toContain('progress-controls flex items-center gap-2 flex-wrap min-w-0')
    expect(source).toContain('progress-row surface-card-subsection')
    expect(source).not.toContain('rounded="lg"')
    expect(source).not.toContain('text-neutral-100')
    expect(css).toMatch(/\.graph-node-button:focus-visible/)
  })
})
