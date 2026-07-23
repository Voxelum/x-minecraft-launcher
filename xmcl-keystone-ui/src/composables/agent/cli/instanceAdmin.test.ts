import { describe, expect, test, vi } from 'vitest'
import { ref } from 'vue'
import { makeAgentContext } from '../testContext'
import type { CliContext } from './context'
import { createInstanceAdminOperations, createInstanceCommand } from './instance'

function setup(overrides: Parameters<typeof makeAgentContext>[0] = {}) {
  const selectedInstancePath = ref('/inst')
  const ctx = makeAgentContext({
    selectedInstancePath: selectedInstancePath as any,
    instance: ref({ path: '/inst', runtime: {} }) as any,
    ...overrides,
  })
  const cli = { ctx } as CliContext
  const instanceService = {
    createInstance: vi.fn().mockResolvedValue('/inst/new'),
    duplicateInstance: vi.fn().mockResolvedValue('/inst/copy'),
    deleteInstance: vi.fn().mockResolvedValue(undefined),
  }
  const modpackService = {
    importModpack: vi.fn().mockResolvedValue({ instancePath: '/inst/pack', runtime: { minecraft: '1.20.1' }, version: 'v1' }),
  }
  const admin = createInstanceAdminOperations(cli, { instanceService, modpackService })
  return { command: createInstanceCommand(cli, admin), selectedInstancePath, instanceService, modpackService }
}

describe('instance administration CLI', () => {
  test('creates an instance with runtime options and selects it', async () => {
    const { command, selectedInstancePath, instanceService } = setup()
    const result = await command.execute([
      'create', 'My Pack', '--description', 'Description', '--minecraft', '1.20.1', '--fabric', '0.16.0', '--optifine', 'HD_U_I6',
    ])

    expect(instanceService.createInstance).toHaveBeenCalledWith({
      name: 'My Pack',
      description: 'Description',
      runtime: { minecraft: '1.20.1', fabricLoader: '0.16.0', optifine: 'HD_U_I6' },
    })
    expect(selectedInstancePath.value).toBe('/inst/new')
    expect(result).toEqual({ ok: true, path: '/inst/new', selected: true })
  })

  test('rejects missing names and multiple primary loaders', async () => {
    const { command, instanceService } = setup()
    expect(await command.execute(['create'])).toMatchObject({ error: expect.stringContaining('requires a name') })
    expect(await command.execute(['create', 'Bad', '--forge', '47.3.0', '--fabric', '0.16.0'])).toMatchObject({ error: expect.stringContaining('exactly one mod loader') })
    expect(instanceService.createInstance).not.toHaveBeenCalled()
  })

  test('duplicates the current instance by default and selects the copy', async () => {
    const { command, selectedInstancePath, instanceService } = setup()
    const result = await command.execute(['duplicate'])
    expect(instanceService.duplicateInstance).toHaveBeenCalledWith('/inst')
    expect(selectedInstancePath.value).toBe('/inst/copy')
    expect(result).toMatchObject({ ok: true, path: '/inst/copy', from: '/inst' })
  })

  test('deletes with optional data removal and respects cancellation', async () => {
    const { command, instanceService } = setup()
    await command.execute(['delete', '/inst/old', '--delete-data'])
    expect(instanceService.deleteInstance).toHaveBeenCalledWith('/inst/old', true)

    const cancelled = setup({ interceptDelete: vi.fn().mockResolvedValue(false) })
    expect(await cancelled.command.execute(['delete', '/inst/keep'])).toEqual({ cancelled: true, path: '/inst/keep' })
    expect(cancelled.instanceService.deleteInstance).not.toHaveBeenCalled()
  })

  test('imports a modpack and selects the created instance', async () => {
    const { command, selectedInstancePath, modpackService } = setup()
    expect(await command.execute(['import'])).toMatchObject({ error: expect.stringContaining('requires one absolute modpack path') })
    const result = await command.execute(['import', 'C:/packs/test.mrpack'])
    expect(modpackService.importModpack).toHaveBeenCalledWith('C:/packs/test.mrpack')
    expect(selectedInstancePath.value).toBe('/inst/pack')
    expect(result).toMatchObject({ ok: true, path: '/inst/pack', version: 'v1' })
  })
})
