import { describe, expect, test } from 'vitest'
import { buildAgentSystemPrompt, createXmclBuiltInPayload } from './prompt'
import { getAgentContextTokens, zeroUsage } from './protocol'
import { buildAgentInstanceEdit, createAgentStagedInstallPresenter, isAgentCommandAllowed, isAgentStagedInstallCommand } from './toolPolicy'
import { applyVfsWriteChange, assertVfsRevision, createVfsLaunchEntries, createVfsRevision, createVfsRootEntries, filterAgentLogFiles, normalizeVfsListPath, normalizeVfsPath, normalizeVfsWriteContent, resolveExistingVfsWrite, validateVfsText } from './vfs'
import { createAgentManifestApplyResult, createAgentModDiagnosis, getAgentModCompatibilityGuidance, isAgentRuntimeCompatibilityChanged } from './modDiagnosis'
import { resolveAgentMarketFilters } from './marketFilters'

describe('Agent market filters', () => {
  const runtime = {
    minecraft: '26.1.2',
    forge: '',
    neoForged: '26.1.2.10-beta',
    fabricLoader: '',
    quiltLoader: '',
  }

  test('defaults to the selected instance game version and loader', () => {
    expect(resolveAgentMarketFilters(runtime, { all: false })).toEqual({
      gameVersion: '26.1.2',
      loader: 'neoforge',
    })
  })

  test('allows explicit filters or an intentionally unfiltered query', () => {
    expect(resolveAgentMarketFilters(runtime, { all: false, gameVersion: '1.21.1', loader: 'fabric' })).toEqual({
      gameVersion: '1.21.1',
      loader: 'fabric',
    })
    expect(resolveAgentMarketFilters(runtime, { all: true })).toEqual({
      gameVersion: undefined,
      loader: undefined,
    })
  })
})

describe('Agent mod diagnosis', () => {
  test('reports dependency incompatibilities and duplicate mods', () => {
    const diagnosis = createAgentModDiagnosis(
      [
        { fileName: 'sodium.jar', modId: 'sodium', enabled: true, modLoaders: ['neoforge'] },
        { fileName: 'sodium-copy.jar', modId: 'sodium', enabled: true, modLoaders: ['neoforge'] },
        { fileName: 'fabric-api.jar', modId: 'fabric_api', enabled: true, modLoaders: ['fabric'] },
      ] as any,
      {
        sodium: [
          { modId: 'neoforge', version: '26.1.2.0-beta', requirements: '[26.1.2.10-beta,)', compatible: false },
          { modId: 'minecraft', version: '26.1.2', requirements: '[26.1,26.2)', compatible: true },
        ],
      },
      { sodium: [{ fileName: 'sodium.jar' }, { fileName: 'sodium-copy.jar' }] as any },
      false,
      [{ mod: 'fabric_api', file: 'fabric-api.jar', supportedLoaders: ['fabric'] }],
    )

    expect(diagnosis).toEqual({
      status: 'issues',
      checkedMods: 3,
      incompatibilities: [{
        mod: 'sodium',
        dependency: 'neoforge',
        installedVersion: '26.1.2.0-beta',
        required: '[26.1.2.10-beta,)',
        compatible: false,
        optional: undefined,
      }],
      loaderIncompatibilities: [{ mod: 'fabric_api', file: 'fabric-api.jar', supportedLoaders: ['fabric'] }],
      duplicates: [{ mod: 'sodium', files: ['sodium.jar', 'sodium-copy.jar'] }],
    })
    expect(getAgentModCompatibilityGuidance(diagnosis)).toEqual(expect.arrayContaining([
      expect.stringContaining('`mod update check` without `--skip-version`'),
      expect.stringContaining('upgrade or a downgrade'),
      expect.stringContaining('`instance manifest apply`'),
    ]))
  })

  test('marks a diagnosis pending when watched mod state does not settle', () => {
    expect(createAgentModDiagnosis([], {}, {}, true)).toMatchObject({
      status: 'pending',
      incompatibilities: [],
      loaderIncompatibilities: [],
      duplicates: [],
      note: expect.stringContaining('did not settle'),
    })
  })
})

describe('Agent runtime compatibility changes', () => {
  test('detects Minecraft or loader changes but ignores unrelated runtime fields', () => {
    const before = { minecraft: '1.20.1', forge: '47.3.0', optifine: 'HD_U_I6' }
    expect(isAgentRuntimeCompatibilityChanged(before, { ...before, forge: '', fabricLoader: '0.16.10' })).toBe(true)
    expect(isAgentRuntimeCompatibilityChanged(before, { ...before, minecraft: '1.21.1' })).toBe(true)
    expect(isAgentRuntimeCompatibilityChanged(before, { ...before, optifine: '' })).toBe(false)
  })
})

describe('Agent manifest apply result', () => {
  test('returns changed paths, diagnosis, and compatible replacement guidance as structured data', () => {
    const diagnosis = createAgentModDiagnosis([], {}, {}, false)
    diagnosis.status = 'issues'
    const result = createAgentManifestApplyResult(['mods/new.jar'], ['mods/old.jar'], diagnosis)

    expect(result).toMatchObject({
      ok: true,
      summary: 'Applied 1 addition and 1 removal.',
      applied: 1,
      removed: 1,
      files: { added: ['mods/new.jar'], removed: ['mods/old.jar'] },
      modDiagnosis: { status: 'issues' },
      guidance: expect.arrayContaining([expect.stringContaining('upgrade or a downgrade')]),
    })
  })
})

describe('agent command policy', () => {
  test('does not expose account removal', () => {
    expect(isAgentCommandAllowed('user.logout')).toBe(false)
    expect(isAgentCommandAllowed('instance.launch')).toBe(false)
    expect(isAgentCommandAllowed('mod.install')).toBe(true)
    expect(isAgentStagedInstallCommand('mod.install')).toBe(true)
    expect(isAgentStagedInstallCommand('resourcepack.install')).toBe(true)
    expect(isAgentStagedInstallCommand('shaderpack.install')).toBe(true)
    expect(isAgentStagedInstallCommand('save.install')).toBe(true)
    expect(isAgentStagedInstallCommand('instance.install')).toBe(false)
  })

  test('explains the staged install workflow once and reports every staged file', () => {
    const present = createAgentStagedInstallPresenter()

    expect(present('mod.install', ['mods/sodium.jar'], '/instance')).toEqual({
      ok: true,
      command: 'mod.install',
      staged: true,
      count: 1,
      files: ['mods/sodium.jar'],
      instance: '/instance',
      message: 'mods/sodium.jar has been staged.',
      guidance: expect.stringContaining('instance manifest apply'),
    })
    expect(present('mod.install', ['mods/lithium.jar'], '/instance')).toEqual({
      ok: true,
      command: 'mod.install',
      staged: true,
      count: 1,
      files: ['mods/lithium.jar'],
      instance: '/instance',
      message: 'mods/lithium.jar has been staged.',
    })
    expect(present('mod.install', {
      files: ['mods/sodium-new.jar'],
      manifest: {
        files: ['mods/sodium-new.jar'],
        oldFiles: ['mods/sodium-old.jar'],
      },
    }, '/instance')).toEqual({
      ok: true,
      command: 'mod.install',
      staged: true,
      count: 1,
      files: ['mods/sodium-new.jar'],
      instance: '/instance',
      message: 'mods/sodium-new.jar has been staged.',
      manifest: {
        files: ['mods/sodium-new.jar'],
        oldFiles: ['mods/sodium-old.jar'],
      },
    })
  })
})

describe('buildAgentInstanceEdit', () => {
  test('allowlists non-runtime fields', () => {
    const result = buildAgentInstanceEdit('/instance', {
      maxMemory: 4096,
      author: 'must-not-change',
      runtime: { forge: '', fabricLoader: '0.16.0' },
    })

    expect(result).toEqual({
      payload: {
        instancePath: '/instance',
        maxMemory: 4096,
      },
      edited: ['maxMemory'],
    })
  })
})

describe('agent VFS writes', () => {
  test('hides compressed archives from log listings', () => {
    expect(filterAgentLogFiles(['latest.log', '2026-08-02-1.log.gz', 'debug.log', 'OLD.LOG.GZ'])).toEqual([
      'latest.log',
      'debug.log',
    ])
  })

  test('describes virtual root folders and files with resource counts', () => {
    const entries = createVfsRootEntries({
      mods: { total: 7, enabled: 5, disabled: 2 },
      resourcePacks: { total: 3, enabled: 1, disabled: 2 },
      shaderPacks: { total: 2, enabled: 0, disabled: 2 },
      saves: 4,
      logs: 2,
      crashReports: 1,
      launches: 6,
      config: 9,
      gameProcesses: 1,
      remoteServer: 'alex@example.test',
    })

    expect(entries.find(entry => entry.name === 'mods')).toMatchObject({
      type: 'folder',
      counts: { total: 7, enabled: 5, disabled: 2 },
    })
    expect(entries.find(entry => entry.name === 'instance.json')).toMatchObject({ type: 'file' })
    expect(entries.find(entry => entry.name === 'remote')).toMatchObject({ type: 'folder' })
    expect(entries.find(entry => entry.name === 'logs')).toMatchObject({ type: 'folder', counts: { total: 2 } })
    expect(entries.find(entry => entry.name === 'crash-reports')).toMatchObject({ type: 'folder', counts: { total: 1 } })
    expect(entries.find(entry => entry.name === 'launches')).toMatchObject({ type: 'folder', counts: { total: 6 } })
    expect(entries.some(entry => entry.name === 'launch-failures')).toBe(false)
    expect(createVfsRootEntries({ artifacts: 2 }).find(entry => entry.name === 'artifacts')).toMatchObject({ type: 'folder', counts: { total: 2 } })
    expect(createVfsRootEntries({}).some(entry => entry.name === 'remote')).toBe(false)
  })

  test('lists only evidence available for one launch', () => {
    const entries = createVfsLaunchEntries({
      launchId: '11111111-1111-4111-8111-111111111111',
      operationId: 'operation',
      pid: 42,
      side: 'client',
      version: '1.21.1',
      minecraft: '1.21.1',
      state: 'exited',
      startedAt: 100,
      evidence: { gameLog: 'ambiguous', debugLog: 'available', crashReport: 'available', launcherOutput: 'available' },
    })

    expect(entries.map(entry => entry.name)).toEqual(['summary.json', 'launcher-output.log', 'debug.log', 'crash-report.txt'])
  })

  test('normalizes explicit virtual root paths', () => {
    expect(['', '.', './'].map(path => normalizeVfsListPath(path))).toEqual(['', '', ''])
    expect(normalizeVfsListPath('./mods/')).toBe('mods')
    expect(normalizeVfsListPath('..')).toBe('..')
  })

  test('rejects absolute paths with relative path and cwd guidance', () => {
    const instancePath = String.raw`E:\xmcl2\instances\example`
    for (const path of [String.raw`E:\xmcl2\instances\example\mods`, 'E:/xmcl2/instances/example/mods', '/instances/example/mods', String.raw`\\server\share\mods`]) {
      expect(() => normalizeVfsListPath(path, instancePath)).toThrow(`The VFS cwd is . (the selected instance root at ${instancePath})`)
    }
    expect(() => normalizeVfsPath(String.raw`E:\xmcl2\instances\example\config\foo.toml`, instancePath)).toThrow('Use a relative virtual path')
  })

  test('describes the VFS cwd and relative path requirement in the system prompt', () => {
    const prompt = buildAgentSystemPrompt({
      role: 'launcher-main',
      locale: 'English',
      tools: [{ name: 'vfs_list', readonly: true }, { name: 'vfs_write', readonly: false }, { name: 'vfs_shell', readonly: false }],
      readonly: false,
      sessionContext: {
        instancePath: String.raw`E:\xmcl2\instances\example`,
        instanceName: 'Example',
        runtime: { minecraft: '1.21.1' },
        userId: 'user-1',
        page: '/mods',
      },
    })

    expect(prompt.match(/Instance VFS cwd:/g)).toHaveLength(1)
    expect(prompt).toContain('Always pass relative virtual paths')
    expect(prompt).toContain('Never pass the absolute host instance path')
    expect(prompt).toContain('Use `replacements` for small exact literal edits')
    expect(prompt).toContain('only the first match unless `all: true`')
    expect(prompt).toContain('Never issue more than one `vfs_write` for the same path')
    expect(prompt).toContain('Only then use that returned path')
    expect(prompt).toContain('Never run `grep` preemptively')
    expect(prompt).not.toContain('a passive mod compatibility event may arrive')
    expect(prompt).not.toContain('returned `modDiagnosis`')
    expect(prompt).toContain('`vfs_rm` only stages removals in the pending instance manifest and does not require confirmation')
    expect(prompt).toContain('Never claim staged resources are deleted')
    expect(prompt).not.toContain('installRef')
    expect(prompt).not.toContain('modrinth')
    expect(prompt).not.toContain('curseforge')
  })

  test('replaces the generated system prompt with structured XMCL context', () => {
    const payload = createXmclBuiltInPayload({
      model: 'xmcl-agent',
      messages: [
        { role: 'system', content: 'client-generated prompt' },
        { role: 'user', content: 'hello' },
      ],
      tools: [],
      stream: true,
    }, {
      promptVersion: 1,
      agentType: 'launcher',
      locale: 'en',
      sessionContext: {
        instancePath: '/instance',
        instanceName: 'Example',
        runtime: { minecraft: '1.21.1' },
        userId: 'user-1',
        page: '/mods',
      },
    })

    expect(payload.messages).toEqual([{ role: 'user', content: 'hello' }])
    expect(payload.xmcl).toMatchObject({
      promptVersion: 1,
      agentType: 'launcher',
      locale: 'en',
    })
    expect(JSON.stringify(payload)).not.toContain('client-generated prompt')
  })

  test('creates stable content revisions', async () => {
    const revision = await createVfsRevision('value=true\n')
    expect(revision).toBe(await createVfsRevision('value=true\n'))
    expect(await createVfsRevision('value=true\n')).not.toBe(await createVfsRevision('value=false\n'))
    await expect(assertVfsRevision('value=false\n', revision, 'config/example.properties')).rejects.toThrow('Revision conflict')
  })

  test('applies exact replacements sequentially', () => {
    expect(applyVfsWriteChange('enabled=false\nname=old\nname=old\n', {
      replacements: [
        { match: 'enabled=false', replace: 'enabled=true' },
        { match: 'name=old', replace: 'name=new' },
      ],
    })).toBe('enabled=true\nname=new\nname=old\n')
    expect(applyVfsWriteChange('name=old\nname=old\n', {
      replacements: [{ match: 'name=old', replace: 'name=new', all: true }],
    })).toBe('name=new\nname=new\n')
    expect(() => applyVfsWriteChange('enabled=true', {
      replacements: [{ match: 'missing', replace: 'value' }],
    })).toThrow('replacement 1 match was not found')
  })

  test('normalizes shader option writes before verification', () => {
    expect(normalizeVfsWriteContent('optionsshaders.txt', 'shaderPack=Alpha Piscium v1.9.1')).toBe('shaderPack=Alpha Piscium v1.9.1\n')
    expect(normalizeVfsWriteContent('config/example.properties', 'enabled=true')).toBe('enabled=true')
  })

  test('treats a repeated canonical shader write as already applied', async () => {
    const before = 'shaderPack=\n'
    const baseRevision = await createVfsRevision(before)
    const change = { content: 'shaderPack=Alpha Piscium v1.9.1' }
    const first = await resolveExistingVfsWrite('optionsshaders.txt', before, baseRevision, change)

    expect(first).toMatchObject({
      content: 'shaderPack=Alpha Piscium v1.9.1\n',
      alreadyApplied: false,
    })
    await expect(resolveExistingVfsWrite('optionsshaders.txt', first.content, baseRevision, change)).resolves.toMatchObject({
      content: first.content,
      alreadyApplied: true,
    })
  })

  test('rejects unsafe paths and invalid JSON writes', () => {
    expect(normalizeVfsPath('./config/example.json')).toBe('config/example.json')
    expect(() => normalizeVfsPath('config/../options.txt')).toThrow('Invalid virtual path')
    expect(() => validateVfsText('config/example.json', '{')).toThrow('Invalid JSON')
  })

  test('validates server files by virtual path', () => {
    expect(validateVfsText('server/eula.txt', 'eula=true\n')).toBe(10)
    expect(() => validateVfsText('server/eula.txt', '# comment\neula=true\n')).toThrow('must be exactly')
    expect(() => validateVfsText('server/server.properties', 'online-mode=yes\n')).toThrow('must be true or false')
    const uuid = '01234567-89ab-cdef-0123-456789abcdef'
    expect(() => validateVfsText('server/ops.json', JSON.stringify([{ uuid, name: 'player', level: 5, bypassesPlayerLimit: false }]))).toThrow('level must be')
    expect(validateVfsText('server/whitelist.json', JSON.stringify([{ uuid, name: 'player' }]))).toBeGreaterThan(0)
    expect(() => validateVfsText('server/banned-ips.json', JSON.stringify([{ ip: '999.1.1.1', created: 'now', source: 'server', expires: 'forever', reason: 'test' }]))).toThrow('must be an IPv4 or IPv6')
  })

  test('validates shader option files by virtual path', () => {
    expect(validateVfsText('optionsshaders.txt', 'shaderPack=BSL.zip\n')).toBeGreaterThan(0)
    expect(() => validateVfsText('optionsshaders.txt', 'shaderPack')).toThrow('must contain key=value')
    expect(validateVfsText('config/iris.properties', 'shaderPack=BSL.zip\nenableShaders=true\n')).toBeGreaterThan(0)
    expect(() => validateVfsText('config/oculus.properties', 'shaderPack=BSL.zip\nenableShaders=false\n')).toThrow('enableShaders must be true')
  })
})

describe('agent context usage', () => {
  test('uses provider totals and falls back to all token categories', () => {
    expect(getAgentContextTokens({ ...zeroUsage(), input: 100, output: 20, cacheRead: 300, totalTokens: 420 })).toBe(420)
    expect(getAgentContextTokens({ ...zeroUsage(), input: 100, output: 20, cacheRead: 300 })).toBe(420)
  })
})
