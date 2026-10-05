import { parse } from '@vue/compiler-sfc'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import type { InstallModpackOptions } from '@/composables/modpackInstaller'

const script = parse(readFileSync(new URL('./StoreProjectCurseforge.vue', import.meta.url), 'utf8')).descriptor.scriptSetup!.content
const ast = ts.createSourceFile('StoreProjectCurseforge.ts', script, ts.ScriptTarget.Latest, true)
const handlers = ast.statements.filter(node => ts.isVariableStatement(node) &&
  node.declarationList.declarations.some(declaration =>
    ts.isIdentifier(declaration.name) && declaration.name.text === 'onInstall'))
expect(handlers).toHaveLength(1)
const code = ts.transpileModule(handlers[0].getText(ast), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

function setup(thumbnailUrl: string | undefined, url: string | undefined) {
  const context = {
    proj: ref<{ id: number; logo: { thumbnailUrl?: string; url?: string } } | undefined>({
      id: 385053,
      logo: { thumbnailUrl, url },
    }),
    project: ref({ iconUrl: url ?? '' }),
    _installing: ref(false),
    installModpack: vi.fn<(options: InstallModpackOptions) => Promise<void>>().mockResolvedValue(),
  }
  const onInstall = new Function(...Object.keys(context), `${code}; return onInstall`)(...Object.values(context)) as
    (version: { id: string }) => void
  return { ...context, onInstall }
}

describe('CurseForge modpack install icons', () => {
  test.each(['gif', 'png'])('installs the %s thumbnail instead of the full-size logo', async (extension) => {
    const thumbnail = `https://media.forgecdn.net/avatars/thumbnails/1735/273/256/256/icon${extension === 'gif' ? '_animated' : ''}.${extension}`
    const original = `https://media.forgecdn.net/avatars/1735/273/icon.${extension}`
    const state = setup(thumbnail, original)

    state.onInstall({ id: '8813051' })

    expect(state.installModpack).toHaveBeenCalledExactlyOnceWith({
      modId: 385053,
      fileId: 8813051,
      market: 1,
      icon: thumbnail,
    })
    expect(state.project.value.iconUrl).toBe(original)
    expect(state._installing.value).toBe(true)
    await Promise.resolve()
    expect(state._installing.value).toBe(false)
  })

  test.each([undefined, ''])('falls back to the original logo when the thumbnail is %s', (thumbnail) => {
    const original = 'https://media.forgecdn.net/avatars/1735/273/icon.png'
    const state = setup(thumbnail, original)

    state.onInstall({ id: '8813051' })

    expect(state.installModpack).toHaveBeenCalledWith(expect.objectContaining({ icon: original }))
  })

  test('allows installation without a logo', () => {
    const state = setup(undefined, undefined)

    state.onInstall({ id: '8813051' })

    expect(state.installModpack).toHaveBeenCalledWith(expect.objectContaining({ icon: '' }))
  })

  test('does not install before the project is loaded', () => {
    const state = setup(undefined, undefined)
    state.proj.value = undefined

    state.onInstall({ id: '8813051' })

    expect(state.installModpack).not.toHaveBeenCalled()
    expect(state._installing.value).toBe(false)
  })
})
