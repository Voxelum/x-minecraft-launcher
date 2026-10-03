import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

// Execute the unchanged local picker and preview functions from the production SFC.
const script = parse(readFileSync(new URL('./AppAddInstanceDialog.vue', import.meta.url), 'utf8')).descriptor.scriptSetup!.content
const ast = ts.createSourceFile('AppAddInstanceDialog.ts', script, ts.ScriptTarget.Latest, true)
const functions = ast.statements.filter(node => ts.isVariableStatement(node) &&
  node.declarationList.declarations.some(declaration =>
    ts.isIdentifier(declaration.name) && ['onSelectModpack', 'onImportModpack'].includes(declaration.name.text)))
expect(functions).toHaveLength(2)
const code = ts.transpileModule(functions.map(node => node.getText(ast)).join('\n'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText
const mocks = {
  windowController: { showOpenDialog: vi.fn() },
  openModpack: vi.fn(), update: vi.fn(), findInstanceForModpack: vi.fn(),
  waitModpackFiles: vi.fn(), creation: { prepareImport: vi.fn() },
}
function setup() {
  const context = {
    ...mocks, nextTick, t: (key: string) => key,
    loading: ref(false), error: ref<unknown>(), existingInstance: ref(),
    modpackFilePath: ref(''), type: ref(), step: ref(0), instances: ref([]),
  }
  const functions = new Function(...Object.keys(context), `${code};return {onImportModpack,onSelectModpack}`)(...Object.values(context))
  return { ...context, ...functions }
}
beforeEach(() => vi.resetAllMocks())
const settled = () => new Promise(resolve => setTimeout(resolve, 0))

describe('local-file import remains independent of URL routing', () => {
  it('keeps native picker cancellation a no-op and retains ZIP/MRPACK filters', async () => {
    mocks.windowController.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    const state = setup()
    state.onImportModpack()
    await settled()
    expect(mocks.openModpack).not.toHaveBeenCalled()
    expect(mocks.creation.prepareImport).not.toHaveBeenCalled()
    expect(mocks.windowController.showOpenDialog).toHaveBeenCalledWith({
      properties: ['openFile'], filters: [{ name: 'modpack.name', extensions: ['zip', 'mrpack'] }],
    })
  })

  it('previews the selected local archive and retains update-existing detection', async () => {
    const config = { name: 'Existing pack', upstream: { type: 'modrinth-modpack', projectId: 'p1' } }
    mocks.windowController.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['C:\\packs\\local.mrpack'] })
    mocks.openModpack.mockResolvedValue({ config })
    mocks.findInstanceForModpack.mockReturnValue({ name: 'Existing pack', path: 'instance' })
    mocks.waitModpackFiles.mockResolvedValue([])
    const state = setup()
    state.onImportModpack()
    await settled()
    expect(mocks.openModpack).toHaveBeenCalledExactlyOnceWith('C:\\packs\\local.mrpack')
    expect(mocks.update).toHaveBeenCalledWith(config, expect.any(Promise))
    expect(state.existingInstance.value).toEqual({ name: 'Existing pack', path: 'instance' })
    expect(state.type.value).toBe('template')
    expect(state.loading.value).toBe(false)
  })

  it.each([true, false])('preserves local preview failures and resets loading (throw=%s)', async (throws) => {
    const failure = new Error('Invalid local archive')
    if (throws) mocks.openModpack.mockRejectedValue(failure)
    else mocks.openModpack.mockResolvedValue({ error: failure })
    const state = setup()
    await state.onSelectModpack('local.zip')
    expect(state.error.value).toBe(failure)
    expect(mocks.update).not.toHaveBeenCalled()
    expect(state.loading.value).toBe(false)
  })
})
