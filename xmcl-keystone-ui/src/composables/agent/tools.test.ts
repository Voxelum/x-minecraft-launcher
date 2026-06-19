import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { InstanceLogServiceKey, InstanceModsServiceKey, InstanceOptionsServiceKey } from '@xmcl/runtime-api'
import { makeAgentContext, getTool, noopSignal } from './testContext'
import { createXmclTools, buildSystemPrompt } from './tools'

// `createXmclTools` pulls services via `useService`. Mock the module so the
// base tools can be built without a Vue injection context. `vi.mock` is hoisted
// above the imports by vitest, so the stub is in place before `tools.ts` loads.
const h = vi.hoisted(() => ({ services: {} as Record<string, any> }))
vi.mock('../service', () => ({ useService: (key: string) => h.services[key] || {} }))

beforeEach(() => {
  h.services = {}
})

describe('createXmclTools — registry composition', () => {
  test('base toolset includes diagnose_server and the shader-options tools', () => {
    const names = createXmclTools(makeAgentContext()).base.map((t) => t.name)
    for (const expected of [
      'list_instances', 'select_instance', 'vfs_list', 'vfs_read', 'bash',
      'edit_config', 'edit_instance', 'diagnose_instance', 'repair_instance',
      'navigate', 'launch_game', 'kill_game', 'list_game_processes',
      'diagnose_server', 'get_shader_options', 'edit_shader_options',
    ]) {
      expect(names).toContain(expected)
    }
    // server-only actions stay in the lazy pack, not the base set
    expect(names).not.toContain('launch_server')
    expect(names).not.toContain('diagnose_java')
  })

  test('lazy packs are market, troubleshoot, server, worlds, instance_admin, account', () => {
    const reg = createXmclTools(makeAgentContext())
    expect(Object.keys(reg.loadable).sort()).toEqual([
      'account', 'instance_admin', 'market', 'server', 'troubleshoot', 'worlds',
    ])
    // the old split packs are gone
    expect(reg.loadable).not.toHaveProperty('java')
    expect(reg.loadable).not.toHaveProperty('mod_maintenance')
  })

  test('troubleshoot pack merges the mod-maintenance and java tools', async () => {
    const reg = createXmclTools(makeAgentContext())
    const names = (await reg.loadable.troubleshoot.load()).map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining([
      'check_mod_dependencies', 'install_mod_dependencies',
      'scan_unused_mods', 'disable_unused_mods',
      'check_mod_updates', 'apply_mod_updates',
      'diagnose_java', 'install_java',
    ]))
  })

  test('lazy packs that need no network can be loaded', async () => {
    const reg = createXmclTools(makeAgentContext())
    expect((await reg.loadable.server.load()).map((t) => t.name)).toContain('launch_server')
    expect((await reg.loadable.worlds.load()).map((t) => t.name)).toContain('list_worlds')
    expect((await reg.loadable.instance_admin.load()).map((t) => t.name)).toContain('create_instance')
    expect((await reg.loadable.account.load()).map((t) => t.name)).toContain('select_account')
  })

  test('buildSystemPrompt lists the new packs and not the removed ones', () => {
    const reg = createXmclTools(makeAgentContext())
    const prompt = buildSystemPrompt({ locale: 'en', sessionContextMarkdown: '## ctx', loadable: reg.loadable })
    expect(prompt).toContain('`troubleshoot`')
    expect(prompt).toContain('`worlds`')
    expect(prompt).toContain('`instance_admin`')
    expect(prompt).toContain('`account`')
    expect(prompt).not.toContain('`mod_maintenance` —')
  })
})

describe('createXmclTools — base tool behavior', () => {
  test('diagnose_server delegates to ctx.getServerStatus', async () => {
    const getServerStatus = vi.fn().mockResolvedValue({ installed: true })
    const reg = createXmclTools(makeAgentContext({ getServerStatus }))
    const res = await getTool(reg.base, 'diagnose_server').execute({}, noopSignal)
    expect(getServerStatus).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ installed: true })
  })

  test('diagnose_server guards when no instance is selected', async () => {
    const getServerStatus = vi.fn()
    const reg = createXmclTools(makeAgentContext({ getServerStatus, instance: ref({ path: '', runtime: {} }) as any }))
    const res = await getTool(reg.base, 'diagnose_server').execute({}, noopSignal)
    expect(res).toEqual({ error: 'no instance selected' })
    expect(getServerStatus).not.toHaveBeenCalled()
  })

  test('get_shader_options reads from the options service', async () => {
    h.services[InstanceOptionsServiceKey as string] = { getShaderOptions: vi.fn().mockResolvedValue({ shaderPack: 'BSL.zip' }) }
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'get_shader_options').execute({}, noopSignal)
    expect(res).toEqual({ shaderPack: 'BSL.zip' })
  })

  test('edit_shader_options routes to the right config by loader', async () => {
    const editShaderOptions = vi.fn().mockResolvedValue(undefined)
    const editIrisShaderOptions = vi.fn().mockResolvedValue(undefined)
    const editOculusShaderOptions = vi.fn().mockResolvedValue(undefined)
    h.services[InstanceOptionsServiceKey as string] = { editShaderOptions, editIrisShaderOptions, editOculusShaderOptions }
    const reg = createXmclTools(makeAgentContext())
    const edit = getTool(reg.base, 'edit_shader_options')

    await edit.execute({ shaderPack: 'A.zip' }, noopSignal)
    expect(editShaderOptions).toHaveBeenCalledWith({ instancePath: '/inst', shaderPack: 'A.zip' })

    await edit.execute({ shaderPack: 'B.zip', loader: 'iris' }, noopSignal)
    expect(editIrisShaderOptions).toHaveBeenCalledWith({ instancePath: '/inst', shaderPack: 'B.zip' })

    await edit.execute({ shaderPack: '', loader: 'oculus' }, noopSignal)
    expect(editOculusShaderOptions).toHaveBeenCalledWith({ instancePath: '/inst', shaderPack: '' })
  })

  test('navigate rejects unknown routes and pushes known ones', async () => {
    const push = vi.fn()
    const reg = createXmclTools(makeAgentContext({ router: { push } as any }))
    const nav = getTool(reg.base, 'navigate')

    expect(await nav.execute({ path: '/totally-fake' }, noopSignal)).toMatchObject({ error: expect.stringContaining('unknown route') })
    expect(push).not.toHaveBeenCalled()

    expect(await nav.execute({ path: '/mods' }, noopSignal)).toEqual({ ok: true, path: '/mods' })
    expect(push).toHaveBeenCalledWith('/mods')
  })

  test('select_instance switches only to a known instance', async () => {
    const selectedInstancePath = ref('')
    const reg = createXmclTools(makeAgentContext({
      selectedInstancePath: selectedInstancePath as any,
      instances: ref([{ path: '/inst/a', name: 'A', runtime: {} }]) as any,
    }))
    const sel = getTool(reg.base, 'select_instance')

    expect(await sel.execute({ path: '/nope' }, noopSignal)).toMatchObject({ error: expect.stringContaining('not found') })
    expect(selectedInstancePath.value).toBe('')

    expect(await sel.execute({ path: '/inst/a' }, noopSignal)).toEqual({ ok: true, path: '/inst/a' })
    expect(selectedInstancePath.value).toBe('/inst/a')
  })

  test('list_instances returns trimmed instance summaries', async () => {
    const reg = createXmclTools(makeAgentContext({
      instances: ref([{ path: '/inst/a', name: 'A', runtime: { minecraft: '1.20.1' }, version: '', server: undefined, description: '', lastPlayedDate: 0, playtime: 0 }]) as any,
    }))
    const res = await getTool(reg.base, 'list_instances').execute({}, noopSignal) as any[]
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ path: '/inst/a', name: 'A', runtime: { minecraft: '1.20.1' } })
  })
})

describe('createXmclTools — local server vfs (server/ subtree)', () => {
  function withServerServices() {
    h.services[InstanceModsServiceKey as string] = {
      getServerInstanceMods: vi.fn().mockResolvedValue([{ fileName: 'sodium.jar', ino: 7 }]),
    }
    h.services[InstanceOptionsServiceKey as string] = {
      getEULA: vi.fn().mockResolvedValue(true),
      getServerProperties: vi.fn().mockResolvedValue({ port: '25565', motd: 'hi' }),
      getInstanceConfigFiles: vi.fn().mockResolvedValue(['forge.toml']),
      getInstanceConfig: vi.fn().mockResolvedValue('key=value'),
      getServerFile: vi.fn().mockResolvedValue('[{"uuid":"x","name":"alice"}]'),
    }
    h.services[InstanceLogServiceKey as string] = {
      listLogs: vi.fn().mockResolvedValue(['latest.log']),
      getLogContent: vi.fn().mockResolvedValue('l1\nl2\nl3'),
      listCrashReports: vi.fn().mockResolvedValue([]),
      getCrashReportContent: vi.fn().mockResolvedValue('crash'),
    }
  }

  test('root listing exposes a server directory', async () => {
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_list').execute({ path: '' }, noopSignal) as any
    expect(res.entries.map((e: any) => e.name)).toContain('server')
  })

  test('vfs_list server shows the server subtree and reads its status', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_list').execute({ path: 'server' }, noopSignal) as any
    expect(res.path).toBe('/inst/server')
    const names = res.entries.map((e: any) => e.name)
    expect(names).toEqual(expect.arrayContaining(['mods', 'config', 'logs', 'crash-reports', 'server.properties', 'eula.txt']))
    expect(names).toEqual(expect.arrayContaining(['ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'usercache.json']))
    const eula = res.entries.find((e: any) => e.name === 'eula.txt')
    expect(eula.description).toContain('accepted')
  })

  test('vfs_list server/mods lists server-deployed mods', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_list').execute({ path: 'server/mods' }, noopSignal) as any[]
    expect(res).toEqual([{ type: 'file', name: 'sodium.jar', path: 'server/mods/sodium.jar', ino: 7 }])
  })

  test('vfs_list server/config reads the server config dir', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_list').execute({ path: 'server/config' }, noopSignal) as any[]
    expect(h.services[InstanceOptionsServiceKey as string].getInstanceConfigFiles).toHaveBeenCalledWith('/inst/server')
    expect(res).toEqual([{ type: 'file', name: 'forge.toml', path: 'server/config/forge.toml' }])
  })

  test('vfs_read server/server.properties returns the parsed map (instance path, not server dir)', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'server/server.properties' }, noopSignal)
    expect(h.services[InstanceOptionsServiceKey as string].getServerProperties).toHaveBeenCalledWith('/inst')
    expect(res).toEqual({ port: '25565', motd: 'hi' })
  })

  test('vfs_read server/eula.txt reports acceptance', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'server/eula.txt' }, noopSignal)
    expect(res).toEqual({ accepted: true })
  })

  test('vfs_read server/<admin>.json returns raw text via getServerFile', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'server/whitelist.json' }, noopSignal)
    expect(h.services[InstanceOptionsServiceKey as string].getServerFile).toHaveBeenCalledWith('/inst', 'whitelist.json')
    expect(res).toBe('[{"uuid":"x","name":"alice"}]')
  })

  test('vfs_read server/<admin>.json notes a missing file', async () => {
    withServerServices()
    h.services[InstanceOptionsServiceKey as string].getServerFile = vi.fn().mockResolvedValue('')
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'server/ops.json' }, noopSignal) as any
    expect(res).toMatchObject({ content: '', note: expect.stringContaining('does not exist') })
  })

  test('vfs_read server/config/<file> reads from the server config dir', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'server/config/forge.toml' }, noopSignal)
    expect(h.services[InstanceOptionsServiceKey as string].getInstanceConfig).toHaveBeenCalledWith('/inst/server', 'forge.toml')
    expect(res).toBe('key=value')
  })

  test('vfs_read server/logs/<name> tails the server log', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'server/logs/latest.log', tailLines: 2 }, noopSignal)
    expect(h.services[InstanceLogServiceKey as string].getLogContent).toHaveBeenCalledWith('/inst/server', 'latest.log')
    expect(res).toBe('l2\nl3')
  })

  test('vfs_read server/mods/<file> returns basic info with a metadata note', async () => {
    withServerServices()
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'server/mods/sodium.jar' }, noopSignal) as any
    expect(res).toMatchObject({ fileName: 'sodium.jar', ino: 7 })
    expect(res.note).toContain('Server-deployed')
  })
})

