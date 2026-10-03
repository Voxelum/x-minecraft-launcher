import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { h, type VNode } from 'vue'

const compiled = ts.transpileModule(readFileSync(new URL('./vuetify.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
const module = { exports: {} as { vuetify: { icons: { sets: { xmcl: { component: (props: { icon: string }) => VNode } } } } } }
new Function('require', 'module', 'exports', compiled)((id: string) => {
  if (id.endsWith('.vue')) return { default: { name: id.split('/').pop() } }
  if (id === 'vue') return { h }
  if (id === 'vuetify') return { createVuetify: (options: unknown) => options }
  if (id.startsWith('vuetify/')) return {}
  if (id === './constant') return { BuiltinImages: {} }
  if (id === './composables/surfaceTokens') return { DEFAULT_SURFACE_BUTTON_RADIUS: 'lg' }
  throw new Error(`Unexpected import: ${id}`)
}, module, module.exports)

describe('XMCL icon registration', () => {
  it.each([
    ['reddit', 'RedditIcon.vue'], ['github', 'GithubIcon.vue'], ['technic', 'TechnicIcon.vue'],
    ['modrinth', 'ModrinthIcon.vue'], ['curseforge', 'CurseforgeIcon.vue'],
  ])('preserves the %s icon when adding import providers', (icon, name) => {
    expect(module.exports.vuetify.icons.sets.xmcl.component({ icon }).type).toMatchObject({ name })
  })
})
