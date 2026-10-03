import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import { ModuleKind, transpileModule } from 'typescript'
import * as date from '../util/date'

const source = readFileSync(new URL('./SaveProgressCanvas.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const script = compileScript(descriptor, { id: 'save-progress-canvas-test' })
const compiled = transpileModule(script.content, { compilerOptions: { module: ModuleKind.CommonJS } }).outputText
const exports: { default?: vue.Component } = {}
const load = (name: string) => {
  if (name === 'vue') return vue
  if (name === '@/util/date') return date
  throw new Error(`Unexpected canvas dependency: ${name}`)
}
new Function('require', 'exports', 'useI18n', compiled)(load, exports, () => ({ t: (key: string) => key }))

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
})
