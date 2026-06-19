import { describe, test, expect, vi } from 'vitest'
import { ref } from 'vue'
import { createServerTools } from './serverTools'
import { makeAgentContext, getTool, noopSignal } from './testContext'

const NO_INSTANCE = { instance: ref({ path: '', runtime: {} }) as any }

describe('createServerTools', () => {
  test('exposes the expected tool set (diagnose_server is base, not here)', () => {
    const tools = createServerTools(makeAgentContext())
    expect(tools.map((t) => t.name).sort()).toEqual([
      'deploy_server_mods',
      'install_server',
      'kill_server',
      'launch_server',
      'set_server_eula',
      'set_server_properties',
      'write_server_file',
    ].sort())
    expect(tools.map((t) => t.name)).not.toContain('diagnose_server')
  })

  test('install_server delegates to ctx.installServer', async () => {
    const installServer = vi.fn().mockResolvedValue({ ok: true, version: '1.20.1-fabric' })
    const tools = createServerTools(makeAgentContext({ installServer }))
    const res = await getTool(tools, 'install_server').execute({}, noopSignal)
    expect(installServer).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ ok: true, version: '1.20.1-fabric' })
  })

  test('install_server guards when no instance is selected', async () => {
    const installServer = vi.fn()
    const tools = createServerTools(makeAgentContext({ installServer, ...NO_INSTANCE }))
    const res = await getTool(tools, 'install_server').execute({}, noopSignal)
    expect(res).toEqual({ error: 'no instance selected' })
    expect(installServer).not.toHaveBeenCalled()
  })

  test('set_server_eula coerces the accepted flag to boolean', async () => {
    const setServerEula = vi.fn().mockResolvedValue({ ok: true, eula: true })
    const tools = createServerTools(makeAgentContext({ setServerEula }))
    await getTool(tools, 'set_server_eula').execute({ accepted: 1 }, noopSignal)
    expect(setServerEula).toHaveBeenCalledWith(true)
  })

  test('set_server_properties rejects non-object payloads', async () => {
    const setServerProperties = vi.fn()
    const tools = createServerTools(makeAgentContext({ setServerProperties }))
    const res = await getTool(tools, 'set_server_properties').execute({ properties: 'nope' }, noopSignal)
    expect(res).toMatchObject({ error: expect.stringContaining('must be an object') })
    expect(setServerProperties).not.toHaveBeenCalled()
  })

  test('set_server_properties forwards a valid map', async () => {
    const setServerProperties = vi.fn().mockResolvedValue({ ok: true, properties: {} })
    const tools = createServerTools(makeAgentContext({ setServerProperties }))
    await getTool(tools, 'set_server_properties').execute({ properties: { port: 25566 } }, noopSignal)
    expect(setServerProperties).toHaveBeenCalledWith({ port: 25566 })
  })

  test('deploy_server_mods resolves virtual mods/<file> paths to real paths', async () => {
    const deployServerMods = vi.fn().mockResolvedValue({ ok: true })
    const ctx = makeAgentContext({
      deployServerMods,
      mods: ref([{ path: '/inst/mods/sodium.jar', fileName: 'sodium.jar', modId: 'sodium', enabled: true }]) as any,
    })
    const tools = createServerTools(ctx)
    await getTool(tools, 'deploy_server_mods').execute({ paths: ['mods/sodium.jar'] }, noopSignal)
    expect(deployServerMods).toHaveBeenCalledWith(['/inst/mods/sodium.jar'])
  })

  test('deploy_server_mods passes undefined when no paths given (server-fit default)', async () => {
    const deployServerMods = vi.fn().mockResolvedValue({ ok: true })
    const tools = createServerTools(makeAgentContext({ deployServerMods }))
    await getTool(tools, 'deploy_server_mods').execute({}, noopSignal)
    expect(deployServerMods).toHaveBeenCalledWith(undefined)
  })

  test('launch_server forwards the nogui flag', async () => {
    const launchServer = vi.fn().mockResolvedValue({ ok: true })
    const tools = createServerTools(makeAgentContext({ launchServer }))
    await getTool(tools, 'launch_server').execute({ nogui: true }, noopSignal)
    expect(launchServer).toHaveBeenCalledWith({ nogui: true })
  })

  test('kill_server kills the server side with the force flag', async () => {
    const killGame = vi.fn().mockResolvedValue(undefined)
    const tools = createServerTools(makeAgentContext({ killGame }))
    const res = await getTool(tools, 'kill_server').execute({ force: true }, noopSignal)
    expect(killGame).toHaveBeenCalledWith('server', true)
    expect(res).toEqual({ ok: true })
  })

  test('write_server_file delegates to ctx.setServerFile', async () => {
    const setServerFile = vi.fn().mockResolvedValue({ ok: true, file: 'ops.json' })
    const tools = createServerTools(makeAgentContext({ setServerFile }))
    const res = await getTool(tools, 'write_server_file').execute({ file: 'ops.json', content: '[]' }, noopSignal)
    expect(setServerFile).toHaveBeenCalledWith('ops.json', '[]')
    expect(res).toEqual({ ok: true, file: 'ops.json' })
  })

  test('write_server_file guards when no instance is selected', async () => {
    const setServerFile = vi.fn()
    const tools = createServerTools(makeAgentContext({ setServerFile, ...NO_INSTANCE }))
    const res = await getTool(tools, 'write_server_file').execute({ file: 'ops.json', content: '[]' }, noopSignal)
    expect(res).toEqual({ error: 'no instance selected' })
    expect(setServerFile).not.toHaveBeenCalled()
  })
})
