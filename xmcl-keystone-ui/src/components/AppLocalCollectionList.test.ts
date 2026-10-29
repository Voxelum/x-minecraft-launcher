import { readFileSync } from 'node:fs'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const script = parse(readFileSync(new URL('./AppLocalCollectionList.vue', import.meta.url), 'utf8')).descriptor.scriptSetup!.content
const ast = ts.createSourceFile('AppLocalCollectionList.ts', script, ts.ScriptTarget.Latest, true)
const handler = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'onFileSelected')!
const code = ts.transpileModule(handler.getText(ast), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

async function importCollection(parsed: unknown) {
  const context = {
    createCollection: vi.fn().mockResolvedValue({ id: 'imported' }),
    addEntry: vi.fn().mockResolvedValue(undefined),
    emit: vi.fn(),
    notify: vi.fn(),
    t: (key: string) => key,
    toLocalSelectionId: (id: string) => `local:${id}`,
    fileInputRef: ref({ value: 'collection.json' }),
  }
  const onFileSelected = new Function(...Object.keys(context), `${code}; return onFileSelected`)(...Object.values(context))
  await onFileSelected({ target: { files: [{ text: async () => JSON.stringify(parsed) }] } })
  expect(context.fileInputRef.value.value).toBe('')
  return context
}

describe('AppLocalCollectionList import validation', () => {
  it('accepts valid collection json', async () => {
    const valid = {
      name: 'My Collection',
      description: 'A great collection',
      mods: [{ provider: 'modrinth', projectId: 'sodium' }],
      resourcepacks: [],
      shaderpacks: [{ provider: 'curseforge', projectId: '12345' }],
    }
    const state = await importCollection(valid)
    expect(state.createCollection).toHaveBeenCalledExactlyOnceWith({ name: valid.name, description: valid.description })
    expect(state.addEntry.mock.calls.map(([entry]) => entry)).toEqual([
      { collectionId: 'imported', contentType: 'mods', entry: valid.mods[0] },
      { collectionId: 'imported', contentType: 'shaderpacks', entry: valid.shaderpacks[0] },
    ])
    expect(state.emit).toHaveBeenCalledWith('update:select', 'local:imported')
  })

  it.each([null, { name: '' }, { name: '   ' }, { name: 123 }, { name: 'Valid', description: 123 }, { name: 'Valid', description: {} }])('rejects invalid metadata before mutating collections: %j', async (parsed) => {
    const state = await importCollection(parsed)
    expect(state.createCollection).not.toHaveBeenCalled()
    expect(state.addEntry).not.toHaveBeenCalled()
    expect(state.notify).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', body: 'Invalid collection metadata' }))
  })

  it.each(['mods', 'resourcepacks', 'shaderpacks'])('validates every %s entry before creating or importing anything', async (contentType) => {
    for (const invalid of [null, {}, [{ provider: 'invalid', projectId: 'sodium' }], [{ provider: 'modrinth', projectId: '' }], [{ provider: 'modrinth', projectId: 12345 }], [null]]) {
      const state = await importCollection({
        name: 'Test',
        mods: [{ provider: 'modrinth', projectId: 'valid' }],
        [contentType]: invalid,
      })
      expect(state.createCollection).not.toHaveBeenCalled()
      expect(state.addEntry).not.toHaveBeenCalled()
      expect(state.emit).not.toHaveBeenCalled()
      expect(state.notify).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', body: 'Invalid collection entries' }))
    }
  })

  it('allows omitted optional metadata and content lists', async () => {
    const state = await importCollection({ name: '  Test  ' })
    expect(state.createCollection).toHaveBeenCalledExactlyOnceWith({ name: 'Test', description: undefined })
    expect(state.addEntry).not.toHaveBeenCalled()
  })
})
