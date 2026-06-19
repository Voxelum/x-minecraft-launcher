import { describe, test, expect, vi } from 'vitest'
import { ref } from 'vue'
import { createWorldsTools, type WorldsServices } from './worldsTools'
import { makeAgentContext, getTool, noopSignal } from './testContext'

function makeSaves() {
  return ref([
    { name: 'world1', path: '/inst/saves/world1', levelName: 'World 1', gameVersion: '1.20.1', lastPlayed: 111 },
  ]) as any
}

function makeServices(): WorldsServices {
  return {
    savesService: {
      importSave: vi.fn().mockResolvedValue('/inst/saves/imported'),
      exportSave: vi.fn().mockResolvedValue(undefined),
      cloneSave: vi.fn().mockResolvedValue(undefined),
      deleteSave: vi.fn().mockResolvedValue(undefined),
      linkSaveAsServerWorld: vi.fn().mockResolvedValue(undefined),
      getLinkedSaveWorld: vi.fn().mockResolvedValue(undefined),
    },
  }
}

describe('createWorldsTools', () => {
  test('exposes the expected tool set', () => {
    const tools = createWorldsTools(makeAgentContext(), makeServices())
    expect(tools.map((t) => t.name).sort()).toEqual([
      'clone_world',
      'delete_world',
      'export_world',
      'import_world',
      'link_world_as_server',
      'list_worlds',
    ].sort())
  })

  test('list_worlds projects the instance saves', async () => {
    const tools = createWorldsTools(makeAgentContext({ saves: makeSaves() }), makeServices())
    const res = await getTool(tools, 'list_worlds').execute({}, noopSignal)
    expect(res).toEqual([
      { saveName: 'world1', levelName: 'World 1', gameVersion: '1.20.1', lastPlayed: 111, path: '/inst/saves/world1' },
    ])
  })

  test('import_world requires a path', async () => {
    const services = makeServices()
    const tools = createWorldsTools(makeAgentContext({ saves: makeSaves() }), services)
    const res = await getTool(tools, 'import_world').execute({}, noopSignal)
    expect(res).toMatchObject({ error: expect.stringContaining('path is required') })
    expect(services.savesService.importSave).not.toHaveBeenCalled()
  })

  test('import_world forwards instancePath + source path', async () => {
    const services = makeServices()
    const tools = createWorldsTools(makeAgentContext({ saves: makeSaves() }), services)
    const res = await getTool(tools, 'import_world').execute({ path: '/tmp/w.zip', saveName: 'copy' }, noopSignal)
    expect(services.savesService.importSave).toHaveBeenCalledWith({ instancePath: '/inst', path: '/tmp/w.zip', saveName: 'copy' })
    expect(res).toEqual({ ok: true, importedPath: '/inst/saves/imported' })
  })

  test('export_world rejects an unknown world', async () => {
    const services = makeServices()
    const tools = createWorldsTools(makeAgentContext({ saves: makeSaves() }), services)
    const res = await getTool(tools, 'export_world').execute({ saveName: 'ghost', destination: '/tmp/o.zip' }, noopSignal)
    expect(res).toMatchObject({ error: expect.stringContaining('world not found') })
    expect(services.savesService.exportSave).not.toHaveBeenCalled()
  })

  test('export_world defaults zip to true', async () => {
    const services = makeServices()
    const tools = createWorldsTools(makeAgentContext({ saves: makeSaves() }), services)
    await getTool(tools, 'export_world').execute({ saveName: 'world1', destination: '/tmp/o.zip' }, noopSignal)
    expect(services.savesService.exportSave).toHaveBeenCalledWith({ instancePath: '/inst', saveName: 'world1', destination: '/tmp/o.zip', zip: true })
  })

  test('clone_world clones within the current instance by default', async () => {
    const services = makeServices()
    const tools = createWorldsTools(makeAgentContext({ saves: makeSaves() }), services)
    await getTool(tools, 'clone_world').execute({ saveName: 'world1', newSaveName: 'world2' }, noopSignal)
    expect(services.savesService.cloneSave).toHaveBeenCalledWith({
      srcInstancePath: '/inst',
      destInstancePath: '/inst',
      saveName: 'world1',
      newSaveName: 'world2',
    })
  })

  test('delete_world deletes a known world', async () => {
    const services = makeServices()
    const tools = createWorldsTools(makeAgentContext({ saves: makeSaves() }), services)
    const res = await getTool(tools, 'delete_world').execute({ saveName: 'world1' }, noopSignal)
    expect(services.savesService.deleteSave).toHaveBeenCalledWith({ instancePath: '/inst', saveName: 'world1' })
    expect(res).toEqual({ ok: true, deleted: 'world1' })
  })

  test('link_world_as_server links a known world', async () => {
    const services = makeServices()
    const tools = createWorldsTools(makeAgentContext({ saves: makeSaves() }), services)
    const res = await getTool(tools, 'link_world_as_server').execute({ saveName: 'world1' }, noopSignal)
    expect(services.savesService.linkSaveAsServerWorld).toHaveBeenCalledWith({ instancePath: '/inst', saveName: 'world1' })
    expect(res).toEqual({ ok: true, linked: 'world1' })
  })

  test('guards when no instance is selected', async () => {
    const services = makeServices()
    const tools = createWorldsTools(makeAgentContext({ instance: ref({ path: '', runtime: {} }) as any, saves: makeSaves() }), services)
    const res = await getTool(tools, 'list_worlds').execute({}, noopSignal)
    expect(res).toEqual({ error: 'no instance selected' })
  })
})
