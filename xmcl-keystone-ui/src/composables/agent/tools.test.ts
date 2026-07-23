import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { InstanceLogServiceKey, InstanceModsServiceKey, InstanceOptionsServiceKey, InstanceSavesServiceKey } from '@xmcl/runtime-api'
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
  test('base toolset includes the virtual CLI and shader options', () => {
    const names = createXmclTools(makeAgentContext()).base.map((t) => t.name)
    for (const expected of [
      'vfs_list', 'vfs_read', 'bash',
      'vfs_rm',
      'edit_config', 'edit_instance',
    ]) {
      expect(names).toContain(expected)
    }
    // Former standalone actions are represented by virtual CLI commands.
    expect(names).not.toContain('launch_server')
    expect(names).not.toContain('diagnose_java')
  })

  test('workflow guidance is exposed as help domains', () => {
    const reg = createXmclTools(makeAgentContext())
    expect(Object.keys(reg.helpDomains).sort()).toEqual([
      'account', 'instance-admin', 'server', 'troubleshoot', 'worlds',
    ])
  })

  test('account and server commands are registered before instructions load', async () => {
    const bash = getTool(createXmclTools(makeAgentContext()).base, 'bash')
    const account = await bash.execute({ command: 'help account' }, noopSignal) as any
    const server = await bash.execute({ command: 'help server' }, noopSignal) as any
    expect(account.details.join('\n')).toContain('account select')
    expect(server.details.join('\n')).toContain('server deploy-mods')
    expect(server.details.join('\n')).toContain('server eula')
  })

  test('instance and version commands are always registered', async () => {
    const reg = createXmclTools(makeAgentContext())
    const bash = getTool(reg.base, 'bash')
    const help = await bash.execute({ command: 'help version' }, noopSignal) as any
    expect(help.usage).toContain('version list')
    expect(help.details.join('\n')).toContain('version list forge')
    expect(help.details.join('\n')).toContain('--page')
    const instance = await bash.execute({ command: 'help instance' }, noopSignal) as any
    expect(instance.details.join('\n')).toContain('instance create')
    expect(instance.details.join('\n')).toContain('instance duplicate')
  })

  test('buildSystemPrompt is domain-neutral and directs discovery to help', () => {
    const prompt = buildSystemPrompt({ locale: 'en', sessionContextMarkdown: '## ctx' })
    expect(prompt).toContain('bash help domain <name>')
    expect(prompt).not.toContain('server deploy-mods')
    expect(prompt).not.toContain('mods deps check')
    expect(prompt).not.toContain('version list')
  })
})

describe('createXmclTools — base tool behavior', () => {
  test('bash diagnose server delegates to ctx.getServerStatus', async () => {
    const getServerStatus = vi.fn().mockResolvedValue({ installed: true })
    const reg = createXmclTools(makeAgentContext({ getServerStatus }))
    const res = await getTool(reg.base, 'bash').execute({ command: 'diagnose server' }, noopSignal)
    expect(getServerStatus).toHaveBeenCalledTimes(1)
    expect(res).toEqual({ installed: true })
  })

  test('bash diagnose server guards when no instance is selected', async () => {
    const getServerStatus = vi.fn()
    const reg = createXmclTools(makeAgentContext({ getServerStatus, instance: ref({ path: '', runtime: {} }) as any }))
    const res = await getTool(reg.base, 'bash').execute({ command: 'diagnose server' }, noopSignal)
    expect(res).toEqual({ error: 'no instance selected' })
    expect(getServerStatus).not.toHaveBeenCalled()
  })

  test('bash diagnose java reports unavailable status', async () => {
    const reg = createXmclTools(makeAgentContext({ javaStatus: ref(undefined) as any }))
    const result = await getTool(reg.base, 'bash').execute({ command: 'diagnose java' }, noopSignal)
    expect(result).toMatchObject({ available: false })
  })

  test('bash diagnose java summarizes the selected and installed runtimes', async () => {
    const reg = createXmclTools(makeAgentContext({
      javaStatus: ref({ java: { path: '/jdk17', version: '17', majorVersion: 17, valid: true }, javaVersion: { majorVersion: 17 }, compatible: 0, noJava: false }) as any,
      javaIssue: ref(undefined) as any,
      javaList: ref([{ path: '/jdk17', version: '17', majorVersion: 17, valid: true }]) as any,
    }))
    const result = await getTool(reg.base, 'bash').execute({ command: 'diagnose java' }, noopSignal) as any
    expect(result).toMatchObject({
      available: true,
      issue: 'none',
      requiredMajorVersion: 17,
      compatibility: 'matched',
      selectedJava: { path: '/jdk17', majorVersion: 17 },
    })
    expect(result.installedJavas).toHaveLength(1)
  })

  test('bash java install uses required defaults and supports explicit overrides', async () => {
    const installJava = vi.fn().mockResolvedValue({ ok: true, path: '/jdk21' })
    const bash = getTool(createXmclTools(makeAgentContext({ installJava })).base, 'bash')

    expect(await bash.execute({ command: 'java install' }, noopSignal)).toEqual({ ok: true, path: '/jdk21' })
    expect(installJava).toHaveBeenLastCalledWith({ majorVersion: undefined, component: undefined, forceZulu: false })

    await bash.execute({ command: 'java install --major-version 21 --component java-runtime-delta --zulu' }, noopSignal)
    expect(installJava).toHaveBeenLastCalledWith({ majorVersion: 21, component: 'java-runtime-delta', forceZulu: true })
  })

  test('bash java install rejects invalid options', async () => {
    const installJava = vi.fn()
    const bash = getTool(createXmclTools(makeAgentContext({ installJava })).base, 'bash')

    expect(await bash.execute({ command: 'java install --major-version nope' }, noopSignal)).toMatchObject({ error: expect.stringContaining('positive integer') })
    expect(await bash.execute({ command: 'java install --component' }, noopSignal)).toMatchObject({ error: expect.stringContaining('requires a value') })
    expect(installJava).not.toHaveBeenCalled()
  })

  test('vfs_read reads shader options through the virtual filesystem', async () => {
    h.services[InstanceOptionsServiceKey as string] = { getShaderOptions: vi.fn().mockResolvedValue({ shaderPack: 'BSL.zip' }) }
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'shader-options/vanilla' }, noopSignal)
    expect(res).toBe('shaderPack=BSL.zip')
  })

  test('edit_config routes shader options to the selected loader', async () => {
    const editShaderOptions = vi.fn().mockResolvedValue(undefined)
    const editIrisShaderOptions = vi.fn().mockResolvedValue(undefined)
    const editOculusShaderOptions = vi.fn().mockResolvedValue(undefined)
    h.services[InstanceOptionsServiceKey as string] = {
      getShaderOptions: vi.fn().mockResolvedValue({ shaderPack: 'Old.zip' }),
      getIrisShaderOptions: vi.fn().mockResolvedValue({ shaderPack: 'Old.zip' }),
      getOculusShaderOptions: vi.fn().mockResolvedValue({ shaderPack: 'Old.zip' }),
      editShaderOptions,
      editIrisShaderOptions,
      editOculusShaderOptions,
    }
    const reg = createXmclTools(makeAgentContext())
    const edit = getTool(reg.base, 'edit_config')

    await edit.execute({ path: 'shader-options/vanilla', match_string: 'shaderPack=Old.zip', replace_string: 'shaderPack=A.zip' }, noopSignal)
    expect(editShaderOptions).toHaveBeenCalledWith({ instancePath: '/inst', shaderPack: 'A.zip' })

    await edit.execute({ path: 'shader-options/iris', match_string: 'shaderPack=Old.zip', replace_string: 'shaderPack=B.zip' }, noopSignal)
    expect(editIrisShaderOptions).toHaveBeenCalledWith({ instancePath: '/inst', shaderPack: 'B.zip' })

    await edit.execute({ path: 'shader-options/oculus', match_string: 'shaderPack=Old.zip', replace_string: 'shaderPack=' }, noopSignal)
    expect(editOculusShaderOptions).toHaveBeenCalledWith({ instancePath: '/inst', shaderPack: '' })
  })

  test('edit_config edits allowlisted server files by literal replacement', async () => {
    const getServerFile = vi.fn().mockResolvedValue('server-port=25565\nmotd=Old Server\n')
    const setServerFile = vi.fn().mockResolvedValue(undefined)
    h.services[InstanceOptionsServiceKey as string] = { getServerFile, setServerFile }
    const edit = getTool(createXmclTools(makeAgentContext()).base, 'edit_config')

    const result = await edit.execute({
      path: 'server/server.properties',
      match_string: 'motd=Old Server',
      replace_string: 'motd=New Server',
    }, noopSignal)

    expect(setServerFile).toHaveBeenCalledWith('/inst', 'server.properties', 'server-port=25565\nmotd=New Server\n')
    expect(result).toEqual({ ok: true, path: 'server/server.properties', replaced: 1 })
  })

  test('edit_config initializes an empty allowlisted server file', async () => {
    const getServerFile = vi.fn().mockResolvedValue('')
    const setServerFile = vi.fn().mockResolvedValue(undefined)
    h.services[InstanceOptionsServiceKey as string] = { getServerFile, setServerFile }
    const edit = getTool(createXmclTools(makeAgentContext()).base, 'edit_config')

    await edit.execute({ path: 'server/ops.json', match_string: '', replace_string: '[]' }, noopSignal)
    expect(setServerFile).toHaveBeenCalledWith('/inst', 'ops.json', '[]')

    expect(await edit.execute({ path: 'server/eula.txt', match_string: '', replace_string: 'eula=true' }, noopSignal))
      .toMatchObject({ error: expect.stringContaining('allowlisted') })
  })

  test('vfs_rm deletes client resources and invokes the interceptor', async () => {
    const uninstall = vi.fn().mockResolvedValue(undefined)
    const interceptDelete = vi.fn().mockResolvedValue(true)
    h.services[InstanceModsServiceKey as string] = { uninstall }
    const reg = createXmclTools(makeAgentContext({
      interceptDelete,
      mods: ref([{ modId: 'sodium', name: 'Sodium', fileName: 'sodium.jar', path: 'mods/sodium.jar' }]) as any,
    }))
    const rm = getTool(reg.base, 'vfs_rm')

    const result = await rm.execute({ paths: ['mods/sodium.jar'] }, noopSignal)
    expect(interceptDelete).toHaveBeenCalledWith({ instancePath: '/inst', paths: ['mods/sodium.jar'] })
    expect(uninstall).toHaveBeenCalledWith({ path: '/inst', files: ['mods/sodium.jar'] })
    expect(result).toMatchObject({ ok: true, paths: ['mods/sodium.jar'] })
  })

  test('vfs_rm can delete config files and cancellation prevents deletion', async () => {
    const removeInstanceConfig = vi.fn().mockResolvedValue(undefined)
    const interceptDelete = vi.fn().mockResolvedValue(true)
    h.services[InstanceOptionsServiceKey as string] = { removeInstanceConfig }
    const reg = createXmclTools(makeAgentContext({ interceptDelete }))
    const rm = getTool(reg.base, 'vfs_rm')

    await rm.execute({ paths: ['config/mod.toml'] }, noopSignal)
    expect(removeInstanceConfig).toHaveBeenCalledWith('/inst', 'mod.toml')

    interceptDelete.mockResolvedValue(false)
    const cancelled = await rm.execute({ paths: ['config/other.toml'] }, noopSignal)
    expect(cancelled).toEqual({ cancelled: true, paths: ['config/other.toml'] })
    expect(removeInstanceConfig).toHaveBeenCalledTimes(1)
  })

  test('bash navigate rejects unknown routes and pushes known ones', async () => {
    const push = vi.fn()
    const reg = createXmclTools(makeAgentContext({ router: { push } as any }))
    const bash = getTool(reg.base, 'bash')

    expect(await bash.execute({ command: 'navigate /totally-fake' }, noopSignal)).toMatchObject({ error: expect.stringContaining('unknown route') })
    expect(push).not.toHaveBeenCalled()

    expect(await bash.execute({ command: 'navigate /mods' }, noopSignal)).toEqual({ ok: true, path: '/mods' })
    expect(push).toHaveBeenCalledWith('/mods')
  })

  test('bash diagnose and repair run the instance lifecycle operations', async () => {
    const fixInstanceInstall = vi.fn().mockResolvedValue(undefined)
    const reg = createXmclTools(makeAgentContext({ fixInstanceInstall }))
    const bash = getTool(reg.base, 'bash')

    expect(await bash.execute({ command: 'diagnose' }, noopSignal)).toMatchObject({ available: false })
    const repaired = await bash.execute({ command: 'repair' }, noopSignal)
    expect(fixInstanceInstall).toHaveBeenCalledTimes(1)
    expect(repaired).toMatchObject({ ok: true })
  })

  test('bash mods delegates dependency and unused-library maintenance', async () => {
    const checkDependencies = vi.fn().mockResolvedValue({ missing: [] })
    const scanUnused = vi.fn().mockResolvedValue({ unused: [] })
    const disableUnused = vi.fn().mockResolvedValue({ disabled: 0 })
    const reg = createXmclTools(makeAgentContext({
      modMaintenance: {
        checkDependencies,
        scanUnused,
        disableUnused,
        checkUpdates: vi.fn(),
      },
    }))
    const bash = getTool(reg.base, 'bash')

    expect(await bash.execute({ command: 'mods deps check' }, noopSignal)).toEqual({ missing: [] })
    expect(await bash.execute({ command: 'mods deps install' }, noopSignal)).toMatchObject({ error: expect.stringContaining('Usage:') })
    expect(await bash.execute({ command: 'mods unused scan' }, noopSignal)).toEqual({ unused: [] })
    expect(await bash.execute({ command: 'mods unused disable' }, noopSignal)).toEqual({ disabled: 0 })
    expect(checkDependencies).toHaveBeenCalledTimes(1)
    expect(scanUnused).toHaveBeenCalledTimes(1)
    expect(disableUnused).toHaveBeenCalledTimes(1)
  })

  test('bash mods updates check forwards options and preserves user defaults', async () => {
    const checkUpdates = vi.fn().mockResolvedValue({ updates: [] })
    const reg = createXmclTools(makeAgentContext({
      modMaintenance: {
        checkDependencies: vi.fn(),
        scanUnused: vi.fn(),
        disableUnused: vi.fn(),
        checkUpdates,
      },
    }))
    const bash = getTool(reg.base, 'bash')

    await bash.execute({ command: 'mods updates check --policy modrinthOnly --skip-version' }, noopSignal)
    expect(checkUpdates).toHaveBeenLastCalledWith({ policy: 'modrinthOnly', skipVersion: true })

    await bash.execute({ command: 'mods updates check' }, noopSignal)
    expect(checkUpdates).toHaveBeenLastCalledWith({ policy: undefined, skipVersion: undefined })
  })

  test('bash resourcepacks and shaderpacks updates check forward options', async () => {
    const resourcepacks = vi.fn().mockResolvedValue({ updates: [] })
    const shaderpacks = vi.fn().mockResolvedValue({ updates: [] })
    const reg = createXmclTools(makeAgentContext({
      packUpdates: {
        resourcepacks: { check: resourcepacks },
        shaderpacks: { check: shaderpacks },
      },
    }))
    const bash = getTool(reg.base, 'bash')

    await bash.execute({ command: 'resourcepacks updates check --policy curseforgeOnly --skip-version' }, noopSignal)
    await bash.execute({ command: 'shaderpacks updates check' }, noopSignal)

    expect(resourcepacks).toHaveBeenCalledWith({ policy: 'curseforgeOnly', skipVersion: true })
    expect(shaderpacks).toHaveBeenCalledWith({ policy: undefined, skipVersion: undefined })
  })

  test('bash mv adds enable and disable operations to the instance change list', async () => {
    const add = vi.fn().mockResolvedValue({ added: true })
    const disable = vi.fn()
    const enable = vi.fn()
    h.services[InstanceModsServiceKey as string] = { disable, enable }
    const reg = createXmclTools(makeAgentContext({
      instanceChanges: {
        add,
        status: vi.fn(),
        apply: vi.fn(),
        reset: vi.fn(),
      },
      mods: ref([{
        modId: 'sodium',
        name: 'Sodium',
        fileName: 'sodium.jar',
        path: 'mods/sodium.jar',
        hash: 'sha1',
        size: 12,
      }]) as any,
      resourcePacks: ref([{
        id: 'file/faithful.zip',
        fileName: 'faithful.zip',
        path: 'resourcepacks/faithful.zip',
        hash: 'resource-sha1',
        size: 23,
      }]) as any,
      shaderPacks: ref([{
        fileName: 'bsl.zip',
        path: 'shaderpacks/bsl.zip',
        hash: 'shader-sha1',
        size: 34,
      }]) as any,
    }))
    const bash = getTool(reg.base, 'bash')
    const result = await bash.execute({ command: 'mv mods/sodium.jar mods/sodium.jar.disabled' }, noopSignal)
    await bash.execute({ command: 'mv resourcepacks/faithful.zip resourcepacks/faithful.zip.disabled' }, noopSignal)
    await bash.execute({ command: 'mv shaderpacks/bsl.zip shaderpacks/bsl.zip.disabled' }, noopSignal)

    expect(result).toMatchObject({ ok: true, queued: true, action: 'disable' })
    expect(add).toHaveBeenCalledWith({
      label: 'disable mods/sodium.jar',
      oldFiles: [expect.objectContaining({ path: 'mods/sodium.jar', hashes: { sha1: 'sha1' } })],
      files: [expect.objectContaining({ path: 'mods/sodium.jar.disabled', hashes: { sha1: 'sha1' } })],
    })
    expect(add).toHaveBeenCalledWith(expect.objectContaining({
      oldFiles: [expect.objectContaining({ path: 'resourcepacks/faithful.zip', hashes: { sha1: 'resource-sha1' } })],
      files: [expect.objectContaining({ path: 'resourcepacks/faithful.zip.disabled' })],
    }))
    expect(add).toHaveBeenCalledWith(expect.objectContaining({
      oldFiles: [expect.objectContaining({ path: 'shaderpacks/bsl.zip', hashes: { sha1: 'shader-sha1' } })],
      files: [expect.objectContaining({ path: 'shaderpacks/bsl.zip.disabled' })],
    }))
    expect(disable).not.toHaveBeenCalled()
    expect(enable).not.toHaveBeenCalled()
  })

  test('bash world runs non-list/delete world operations', async () => {
    const importSave = vi.fn().mockResolvedValue('/inst/saves/new-world')
    const exportSave = vi.fn().mockResolvedValue(undefined)
    const cloneSave = vi.fn().mockResolvedValue(undefined)
    const linkSaveAsServerWorld = vi.fn().mockResolvedValue(undefined)
    h.services[InstanceSavesServiceKey as string] = { importSave, exportSave, cloneSave, linkSaveAsServerWorld }
    const reg = createXmclTools(makeAgentContext({
      saves: ref([{ name: 'world1', path: 'saves/world1' }]) as any,
    }))
    const bash = getTool(reg.base, 'bash')

    await bash.execute({ command: 'world import C:/backup/world.zip imported' }, noopSignal)
    await bash.execute({ command: 'world export world1 C:/backup/world.zip' }, noopSignal)
    await bash.execute({ command: 'world clone world1 world-copy' }, noopSignal)
    await bash.execute({ command: 'world link world1' }, noopSignal)

    expect(importSave).toHaveBeenCalledWith({ instancePath: '/inst', path: 'C:/backup/world.zip', saveName: 'imported' })
    expect(exportSave).toHaveBeenCalledWith({ instancePath: '/inst', saveName: 'world1', destination: 'C:/backup/world.zip', zip: true })
    expect(cloneSave).toHaveBeenCalledWith({ srcInstancePath: '/inst', destInstancePath: '/inst', saveName: 'world1', newSaveName: 'world-copy' })
    expect(linkSaveAsServerWorld).toHaveBeenCalledWith({ instancePath: '/inst', saveName: 'world1' })
  })

  test('bash instance change delegates transaction operations', async () => {
    const instanceChanges = {
      add: vi.fn(),
      status: vi.fn().mockResolvedValue({ changes: {} }),
      apply: vi.fn().mockResolvedValue({ applied: true }),
      reset: vi.fn().mockResolvedValue({ reset: true }),
    }
    const bash = getTool(createXmclTools(makeAgentContext({ instanceChanges })).base, 'bash')

    expect(await bash.execute({ command: 'instance change status' }, noopSignal)).toEqual({ changes: {} })
    expect(await bash.execute({ command: 'instance change commit' }, noopSignal)).toMatchObject({ error: expect.stringContaining('Usage:') })
    expect(await bash.execute({ command: 'instance change apply' }, noopSignal)).toEqual({ applied: true })
    expect(await bash.execute({ command: 'instance change reset' }, noopSignal)).toEqual({ reset: true })
  })

  test('virtual commands return usage for invalid arguments', async () => {
    const reg = createXmclTools(makeAgentContext())
    const bash = getTool(reg.base, 'bash')

    await expect(bash.execute({ command: 'launch desktop' }, noopSignal))
      .resolves.toMatchObject({ error: expect.stringContaining('Usage: launch [client|server] [--nogui]') })
    await expect(bash.execute({ command: 'world export only-one-argument' }, noopSignal))
      .resolves.toMatchObject({ error: expect.stringContaining('Usage: world <import|export|clone|link> ...') })
    await expect(bash.execute({ command: 'navigate' }, noopSignal))
      .resolves.toMatchObject({ error: expect.stringContaining('Usage: navigate <route>') })
  })

  test('bash help exposes detailed command usage on demand', async () => {
    const reg = createXmclTools(makeAgentContext())
    const bash = getTool(reg.base, 'bash')

    const list = await bash.execute({ command: 'help' }, noopSignal) as any
    expect(list.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'world', usage: 'world <import|export|clone|link> ...' }),
      expect.objectContaining({ name: 'navigate', usage: 'navigate <route>' }),
    ]))
    expect(list.domains).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'troubleshoot' }),
      expect.objectContaining({ name: 'server' }),
    ]))

    const world = await bash.execute({ command: 'help world' }, noopSignal) as any
    expect(world.usage).toBe('world <import|export|clone|link> ...')
    expect(world.details.join('\n')).toContain('absoluteDestination')

    const navigate = await bash.execute({ command: 'help navigate' }, noopSignal) as any
    expect(navigate.details.join('\n')).toContain('/mods')

    const diagnose = await bash.execute({ command: 'help diagnose' }, noopSignal) as any
    expect(diagnose.usage).toBe('diagnose [client|server|java]')
    expect(diagnose.details.join('\n')).toContain('diagnose server')
    expect(diagnose.details.join('\n')).toContain('diagnose java')

    const mods = await bash.execute({ command: 'help mods' }, noopSignal) as any
    expect(mods.usage).toContain('mods <deps check')
    expect(mods.details.join('\n')).toContain('mods updates check')

    const resourcepacks = await bash.execute({ command: 'help resourcepacks' }, noopSignal) as any
    expect(resourcepacks.usage).toContain('resourcepacks updates check')
    const shaderpacks = await bash.execute({ command: 'help shaderpacks' }, noopSignal) as any
    expect(shaderpacks.usage).toContain('shaderpacks updates check')

    const market = await bash.execute({ command: 'help market' }, noopSignal) as any
    expect(market.details.join('\n')).toContain('--page')
    expect(market.details.join('\n')).toContain('market install')

    const java = await bash.execute({ command: 'help java' }, noopSignal) as any
    expect(java.usage).toContain('java install')
    expect(java.details.join('\n')).toContain('--major-version')
    expect(java.details.join('\n')).toContain('--zulu')

    const domains = await bash.execute({ command: 'help domains' }, noopSignal) as any
    expect(domains.domains).toHaveLength(5)
    const serverDomain = await bash.execute({ command: 'help domain server' }, noopSignal) as any
    expect(serverDomain.instructions.join('\n')).toContain('server install')
    expect(serverDomain.instructions.join('\n')).toContain('edit_config')

    const instance = await bash.execute({ command: 'help instance' }, noopSignal) as any
    expect(instance.usage).toContain('instance <list|select|change> ...')
    expect(instance.usage).toContain('instance <create|duplicate|delete|import> ...')
    expect(instance.details.join('\n')).toContain('instance list')
    expect(instance.details.join('\n')).toContain('instance select')
    expect(instance.details.join('\n')).toContain('instance change apply')
  })

  test('bash no longer exposes rm; deletions use vfs_rm', async () => {
    const reg = createXmclTools(makeAgentContext())
    const bash = getTool(reg.base, 'bash')
    await expect(bash.execute({ command: 'rm mods/example.jar' }, noopSignal))
      .resolves.toEqual({ error: 'unsupported virtual CLI command: `rm`' })
  })

  test('bash instance select switches only to a known instance', async () => {
    const selectedInstancePath = ref('')
    const reg = createXmclTools(makeAgentContext({
      selectedInstancePath: selectedInstancePath as any,
      instances: ref([{ path: '/inst/a', name: 'A', runtime: {} }]) as any,
    }))
    const bash = getTool(reg.base, 'bash')

    expect(await bash.execute({ command: 'instance select /nope' }, noopSignal)).toMatchObject({ error: expect.stringContaining('not found') })
    expect(selectedInstancePath.value).toBe('')

    expect(await bash.execute({ command: 'instance select /inst/a' }, noopSignal)).toEqual({ ok: true, path: '/inst/a' })
    expect(selectedInstancePath.value).toBe('/inst/a')
  })

  test('bash instance list returns trimmed instance summaries', async () => {
    const reg = createXmclTools(makeAgentContext({
      instances: ref([{ path: '/inst/a', name: 'A', runtime: { minecraft: '1.20.1' }, version: '', server: undefined, description: '', lastPlayedDate: 0, playtime: 0 }]) as any,
    }))
    const res = await getTool(reg.base, 'bash').execute({ command: 'instance list' }, noopSignal) as any[]
    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ path: '/inst/a', name: 'A', runtime: { minecraft: '1.20.1' } })
  })

  test('bash launch and kill operate on the requested side', async () => {
    const launch = vi.fn().mockResolvedValue({ ok: true, side: 'server' })
    const killGame = vi.fn().mockResolvedValue(undefined)
    const reg = createXmclTools(makeAgentContext({ launch, killGame }))
    const bash = getTool(reg.base, 'bash')

    await bash.execute({ command: 'launch server --nogui' }, noopSignal)
    expect(launch).toHaveBeenCalledWith('server', { nogui: true })

    const result = await bash.execute({ command: 'kill server --force' }, noopSignal)
    expect(killGame).toHaveBeenCalledWith('server', true)
    expect(result).toEqual({ ok: true, side: 'server', force: true })
  })

  test('bash launch and kill default to the client side', async () => {
    const launch = vi.fn().mockResolvedValue({ ok: true, side: 'client' })
    const killGame = vi.fn().mockResolvedValue(undefined)
    const reg = createXmclTools(makeAgentContext({ launch, killGame }))
    const bash = getTool(reg.base, 'bash')

    await bash.execute({ command: 'launch' }, noopSignal)
    await bash.execute({ command: 'kill' }, noopSignal)
    expect(launch).toHaveBeenCalledWith('client', { nogui: false })
    expect(killGame).toHaveBeenCalledWith('client', false)
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

  test('root listing exposes current-instance game processes', async () => {
    const reg = createXmclTools(makeAgentContext({
      gameProcesses: ref([
        { pid: 101, side: 'client', ready: true, options: { gameDirectory: '/inst', version: '1.20.1' } },
        { pid: 202, side: 'server', ready: true, options: { gameDirectory: '/inst', version: 'server-1.20.1' } },
      ]) as any,
    }))
    const res = await getTool(reg.base, 'vfs_list').execute({ path: 'game-processes' }, noopSignal) as any[]
    expect(res.map((p: any) => p.name)).toEqual(['client-101', 'server-202'])
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

  test('vfs_read server/server.properties returns raw text for edit_config', async () => {
    withServerServices()
    h.services[InstanceOptionsServiceKey as string].getServerFile.mockResolvedValue('server-port=25565\nmotd=hi\n')
    const reg = createXmclTools(makeAgentContext())
    const res = await getTool(reg.base, 'vfs_read').execute({ path: 'server/server.properties' }, noopSignal)
    expect(h.services[InstanceOptionsServiceKey as string].getServerFile).toHaveBeenCalledWith('/inst', 'server.properties')
    expect(res).toBe('server-port=25565\nmotd=hi\n')
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

