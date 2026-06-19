import { describe, test, expect, vi } from 'vitest'
import { ref } from 'vue'
import { createInstanceAdminTools, type InstanceAdminServices } from './instanceAdminTools'
import { makeAgentContext, getTool, noopSignal } from './testContext'

function makeServices(over: Partial<InstanceAdminServices['instanceService'] & InstanceAdminServices['modpackService']> = {}): InstanceAdminServices {
  return {
    instanceService: {
      createInstance: vi.fn().mockResolvedValue('/inst/new'),
      duplicateInstance: vi.fn().mockResolvedValue('/inst/copy'),
      deleteInstance: vi.fn().mockResolvedValue(undefined),
      ...over,
    } as any,
    modpackService: {
      importModpack: vi.fn().mockResolvedValue({ instancePath: '/inst/pack', runtime: { minecraft: '1.20.1' }, version: 'v1' }),
      ...over,
    } as any,
  }
}

describe('createInstanceAdminTools', () => {
  test('exposes the expected tool set', () => {
    const tools = createInstanceAdminTools(makeAgentContext(), makeServices())
    expect(tools.map((t) => t.name).sort()).toEqual([
      'create_instance',
      'delete_instance',
      'duplicate_instance',
      'import_modpack',
    ].sort())
  })

  test('create_instance requires a name', async () => {
    const services = makeServices()
    const tools = createInstanceAdminTools(makeAgentContext(), services)
    const res = await getTool(tools, 'create_instance').execute({ name: '  ' }, noopSignal)
    expect(res).toMatchObject({ error: expect.stringContaining('name is required') })
    expect(services.instanceService.createInstance).not.toHaveBeenCalled()
  })

  test('create_instance forwards name/description/runtime and selects the new instance', async () => {
    const services = makeServices()
    const selectedInstancePath = ref('/inst')
    const tools = createInstanceAdminTools(makeAgentContext({ selectedInstancePath: selectedInstancePath as any }), services)
    const res = await getTool(tools, 'create_instance').execute(
      { name: 'My Pack', description: 'd', runtime: { minecraft: '1.20.1', fabricLoader: '0.16.0' } },
      noopSignal,
    )
    expect(services.instanceService.createInstance).toHaveBeenCalledWith({
      name: 'My Pack',
      description: 'd',
      runtime: { minecraft: '1.20.1', fabricLoader: '0.16.0' },
    })
    expect(selectedInstancePath.value).toBe('/inst/new')
    expect(res).toEqual({ ok: true, path: '/inst/new', selected: true })
  })

  test('duplicate_instance defaults to the current instance and selects the copy', async () => {
    const services = makeServices()
    const selectedInstancePath = ref('/inst')
    const tools = createInstanceAdminTools(
      makeAgentContext({ selectedInstancePath: selectedInstancePath as any, instance: ref({ path: '/inst', runtime: {} }) as any }),
      services,
    )
    const res = await getTool(tools, 'duplicate_instance').execute({}, noopSignal)
    expect(services.instanceService.duplicateInstance).toHaveBeenCalledWith('/inst')
    expect(selectedInstancePath.value).toBe('/inst/copy')
    expect(res).toMatchObject({ ok: true, path: '/inst/copy', from: '/inst' })
  })

  test('delete_instance passes the deleteData flag (default false)', async () => {
    const services = makeServices()
    const tools = createInstanceAdminTools(makeAgentContext(), services)
    await getTool(tools, 'delete_instance').execute({ path: '/inst/old' }, noopSignal)
    expect(services.instanceService.deleteInstance).toHaveBeenCalledWith('/inst/old', false)

    await getTool(tools, 'delete_instance').execute({ path: '/inst/old', deleteData: true }, noopSignal)
    expect(services.instanceService.deleteInstance).toHaveBeenLastCalledWith('/inst/old', true)
  })

  test('import_modpack requires a path and selects the created instance', async () => {
    const services = makeServices()
    const selectedInstancePath = ref('/inst')
    const tools = createInstanceAdminTools(makeAgentContext({ selectedInstancePath: selectedInstancePath as any }), services)

    const missing = await getTool(tools, 'import_modpack').execute({}, noopSignal)
    expect(missing).toMatchObject({ error: expect.stringContaining('path is required') })

    const res = await getTool(tools, 'import_modpack').execute({ path: '/tmp/pack.mrpack' }, noopSignal)
    expect(services.modpackService.importModpack).toHaveBeenCalledWith('/tmp/pack.mrpack')
    expect(selectedInstancePath.value).toBe('/inst/pack')
    expect(res).toMatchObject({ ok: true, path: '/inst/pack', version: 'v1' })
  })
})
