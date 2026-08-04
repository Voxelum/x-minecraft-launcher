import { describe, expect, test, vi } from 'vitest'
import {
  type AgentCommandOperations,
  compactCurseforgeProjectResult,
  compactModrinthProjectResult,
  createAgentRuntimeCommandIndex,
  createAgentRuntimeCommands,
  executeAgentRuntimeCommand,
  withModrinthSearchInstallRef,
} from './commands'
import { buildAgentSystemPrompt } from './prompt'

function createOperations() {
  return {
    listDocuments: vi.fn(async () => [
      {
        id: 'shaderpack-enable',
        description: 'Evaluate hardware and configure shader support.',
      },
    ]),
    searchDocuments: vi.fn(async () => [
      {
        id: 'shaderpack-enable',
        description: 'Evaluate hardware and configure shader support.',
        score: 12,
      },
    ]),
    readDocument: vi.fn(async () => ({
      id: 'shaderpack-enable',
      description: 'Evaluate hardware and configure shader support.',
      body: 'Run system info and set enableShaders=true.',
    })),
    getSystemInfo: vi.fn(async () => ({
      cpu: { model: 'Test CPU', logicalCores: 8, speedMHz: 3200 },
      description: 'Evaluate hardware and configure shader support.',
      disk: { totalBytes: 1_000_000_000_000, freeBytes: 500_000_000_000 },
      gpus: [{ name: 'Test GPU', vendorId: 1, deviceId: 2 }],
    })),
    queryModrinth: vi.fn(),
    mutateModrinth: vi.fn(),
    getModrinthCategories: vi.fn(),
    searchModrinth: vi.fn(),
    getModrinthVersions: vi.fn(),
    getCurseforgeCategories: vi.fn(),
    queryCurseforge: vi.fn(),
    searchCurseforge: vi.fn(),
    getCurseforgeFiles: vi.fn(),
    listLoaderMetadata: vi.fn(),
    listMinecraftMetadata: vi.fn(),
    listLocalVersions: vi.fn(),
    getLocalVersion: vi.fn(),
    refreshLocalVersions: vi.fn(),
    deleteLocalVersion: vi.fn(),
    openLocalVersion: vi.fn(),
    getInstanceRuntime: vi.fn(),
    setInstanceRuntime: vi.fn(),
    getServerStatus: vi.fn(async () => ({ installed: true, running: 0 })),
    installServer: vi.fn(),
    deployServerMods: vi.fn(),
    startServer: vi.fn(),
    stopServer: vi.fn(),
    getRemoteServerStatus: vi.fn(async () => ({ active: true, pid: 42 })),
    testRemoteServerConnection: vi.fn(),
    installRemoteServerService: vi.fn(),
    uninstallRemoteServerService: vi.fn(),
    startRemoteServer: vi.fn(),
    stopRemoteServer: vi.fn(),
    restartRemoteServer: vi.fn(),
    listAccounts: vi.fn(),
    selectAccount: vi.fn(),
    diagnoseJava: vi.fn(),
    listJava: vi.fn(),
    selectJava: vi.fn(),
    installJava: vi.fn(),
    installInstance: vi.fn(),
    getInstanceManifest: vi.fn(),
    applyInstanceManifest: vi.fn(),
    discardInstanceManifest: vi.fn(),
    checkModDependencies: vi.fn(),
    diagnoseModCompatibility: vi.fn(),
    installModDependencies: vi.fn(),
    scanUnusedMods: vi.fn(),
    checkModUpdates: vi.fn(),
    stageModUpdates: vi.fn(),
    importWorld: vi.fn(),
    exportWorld: vi.fn(),
    cloneWorld: vi.fn(),
    linkWorldAsServer: vi.fn(),
    listInstances: vi.fn(),
    createInstance: vi.fn(),
    diagnoseInstance: vi.fn(),
    repairInstance: vi.fn(),
    duplicateInstance: vi.fn(),
    deleteInstance: vi.fn(),
    importModpack: vi.fn(),
    listVfs: vi.fn(),
    readVfs: vi.fn(),
    removeVfs: vi.fn(),
    grepConfig: vi.fn(),
    moveResource: vi.fn(),
    launchGame: vi.fn(),
    wait: vi.fn(),
    stopGame: vi.fn(),
    navigateUi: vi.fn(),
  } as unknown as AgentCommandOperations
}

describe('Modrinth search install references', () => {
  test('turns the matching latest version into an exact install ref', () => {
    expect(
      withModrinthSearchInstallRef({ project_id: 'AANobbMI', latest_version: 'YZNHS9YH' }),
    ).toEqual({
      project_id: 'AANobbMI',
      latest_version: 'YZNHS9YH',
      installRef: 'modrinth:AANobbMI@YZNHS9YH',
    })
    expect(withModrinthSearchInstallRef({ project_id: 'AANobbMI' })).toEqual({
      project_id: 'AANobbMI',
    })
  })
})

function getCommand(name: string, operations: AgentCommandOperations) {
  return createAgentRuntimeCommandIndex(createAgentRuntimeCommands(operations)).get(name)!
}

function getServerCommand(operations: AgentCommandOperations) {
  return createAgentRuntimeCommands(operations).find((command) => command.name === 'server')!
}

function getRemoteServerCommand(operations: AgentCommandOperations) {
  return createAgentRuntimeCommands(operations).find((command) => command.name === 'remote')!
}

describe('server virtual shell command', () => {
  test('dispatches status without arguments', async () => {
    const operations = createOperations()
    await expect(getServerCommand(operations).execute(['status'])).resolves.toEqual({
      installed: true,
      running: 0,
    })
    expect(operations.getServerStatus).toHaveBeenCalledOnce()
  })

  test('deploys all compatible mods', async () => {
    const operations = createOperations()
    await getServerCommand(operations).execute(['mods', 'deploy', '--compatible'])
    expect(operations.deployServerMods).toHaveBeenCalledWith(
      { compatible: true, paths: [] },
      undefined,
    )
  })

  test('accepts repeated explicit mod paths', async () => {
    const operations = createOperations()
    await getServerCommand(operations).execute([
      'mods',
      'deploy',
      '--path',
      'C:/mods/a.jar',
      '--path',
      'C:/mods/b.jar',
    ])
    expect(operations.deployServerMods).toHaveBeenCalledWith(
      {
        compatible: false,
        paths: ['C:/mods/a.jar', 'C:/mods/b.jar'],
      },
      undefined,
    )
  })

  test('routes start and stop flags', async () => {
    const operations = createOperations()
    const command = getServerCommand(operations)
    await command.execute(['start', '--nogui'])
    await command.execute(['stop', '--force'])
    expect(operations.startServer).toHaveBeenCalledWith({ nogui: true }, undefined)
    expect(operations.stopServer).toHaveBeenCalledWith({ force: true }, undefined)
  })

  test('requires one mod deployment mode', async () => {
    const operations = createOperations()
    const command = getServerCommand(operations)
    await expect(command.execute(['mods', 'deploy'])).rejects.toThrow('exactly one')
    await expect(
      command.execute(['mods', 'deploy', '--compatible', '--path', 'C:/mods/a.jar']),
    ).rejects.toThrow('exactly one')
  })
})

describe('remote server virtual shell command', () => {
  test('dispatches read-only status and connection checks', async () => {
    const operations = createOperations()
    const command = getRemoteServerCommand(operations)
    await expect(command.execute(['status'])).resolves.toEqual({ active: true, pid: 42 })
    await command.execute(['test'])
    expect(operations.getRemoteServerStatus).toHaveBeenCalledOnce()
    expect(operations.testRemoteServerConnection).toHaveBeenCalledOnce()
  })

  test('dispatches service and lifecycle operations', async () => {
    const operations = createOperations()
    const command = getRemoteServerCommand(operations)
    await command.execute(['service', 'install'])
    await command.execute(['service', 'uninstall'])
    await command.execute(['service', 'start'])
    await command.execute(['service', 'stop'])
    await command.execute(['service', 'restart'])
    expect(operations.installRemoteServerService).toHaveBeenCalledOnce()
    expect(operations.uninstallRemoteServerService).toHaveBeenCalledOnce()
    expect(operations.startRemoteServer).toHaveBeenCalledOnce()
    expect(operations.stopRemoteServer).toHaveBeenCalledOnce()
    expect(operations.restartRemoteServer).toHaveBeenCalledOnce()
  })

  test('rejects unsupported arguments', async () => {
    const operations = createOperations()
    const command = getRemoteServerCommand(operations)
    await expect(command.execute(['status', '--json'])).rejects.toThrow('Unknown remote command')
    await expect(command.execute(['service'])).rejects.toThrow('Unknown remote command')
  })
})

describe('management virtual shell commands', () => {
  test('waits for a timeout or a game process with an optional timeout', async () => {
    const operations = createOperations()
    const command = getCommand('wait', operations)

    await command.execute(['--timeout', '2.5'])
    await command.execute(['--game-process', '42'])
    await command.execute(['--game-process', '42', '--timeout', '30'])

    expect(operations.wait).toHaveBeenNthCalledWith(
      1,
      { timeoutSeconds: 2.5, gameProcess: undefined },
      undefined,
    )
    expect(operations.wait).toHaveBeenNthCalledWith(
      2,
      { timeoutSeconds: undefined, gameProcess: 42 },
      undefined,
    )
    expect(operations.wait).toHaveBeenNthCalledWith(
      3,
      { timeoutSeconds: 30, gameProcess: 42 },
      undefined,
    )
  })

  test('rejects invalid wait arguments', async () => {
    const operations = createOperations()
    const command = getCommand('wait', operations)

    await expect(executeAgentRuntimeCommand(command, [])).resolves.toContain('Usage: wait')
    await expect(command.execute(['--timeout', '0'])).rejects.toThrow(
      '--timeout must be a positive number',
    )
    await expect(command.execute(['--game-process', '1.5'])).rejects.toThrow(
      '--game-process must be a positive integer',
    )
  })

  test('shows help for bare command groups but executes no-argument actions', async () => {
    const operations = createOperations()
    vi.mocked(operations.launchGame).mockResolvedValue({ ok: true, launchId: 'launch-id', pid: 42 })
    await expect(
      executeAgentRuntimeCommand(getCommand('instance', operations), []),
    ).resolves.toContain(
      'Usage: instance <list|create|diagnose|install|repair|manifest|duplicate|delete|import>',
    )
    await executeAgentRuntimeCommand(getCommand('instance', operations), ['list'])
    await expect(executeAgentRuntimeCommand(getCommand('launch', operations), [])).resolves.toEqual(
      { ok: true, launchId: 'launch-id', pid: 42 },
    )
    expect(operations.listInstances).toHaveBeenCalledOnce()
    expect(operations.launchGame).toHaveBeenCalledOnce()
  })

  test('reports local hardware through system info', async () => {
    const operations = createOperations()
    const command = getCommand('system', operations)
    await expect(executeAgentRuntimeCommand(command, [])).resolves.toContain('Usage: system info')
    await expect(executeAgentRuntimeCommand(command, ['info'])).resolves.toMatchObject({
      cpu: { model: 'Test CPU', logicalCores: 8 },
      gpus: [{ name: 'Test GPU' }],
    })
    expect(operations.getSystemInfo).toHaveBeenCalledOnce()
  })

  test.each([
    ['system', ['status']],
    ['modrinth', ['info']],
    ['curseforge', ['info']],
    ['version', ['status']],
    ['version-metadata', ['info']],
    ['user', ['info']],
    ['java', ['info']],
    ['mod', ['info']],
    ['world', ['info']],
    ['instance', ['info']],
    ['ui', ['info']],
    ['server', ['info']],
    ['remote', ['info']],
  ])('includes %s usage for an unknown subcommand', async (name, argv) => {
    const command = getCommand(name, createOperations())
    await expect(executeAgentRuntimeCommand(command, argv)).rejects.toThrow(
      `Usage: ${command.usage}`,
    )
  })

  test('dispatches the complete read-only Modrinth API surface', async () => {
    const operations = createOperations()
    const command = getCommand('modrinth', operations)
    await command.execute(['tags', 'loaders'])
    await command.execute(['project', 'sodium', 'lithium'])
    await command.execute(['version', 'version1', 'version2'])
    await command.execute([
      'hash',
      'abc',
      'def',
      '--algorithm',
      'sha512',
      '--latest',
      '--loader',
      'fabric',
      '--game-version',
      '1.21.1',
    ])
    await command.execute(['user', 'user-id', '--projects'])
    await command.execute(['me'])
    await command.execute(['team', 'sodium'])
    expect(operations.queryModrinth).toHaveBeenNthCalledWith(
      1,
      { kind: 'tags', tag: 'loaders' },
      undefined,
    )
    expect(operations.queryModrinth).toHaveBeenNthCalledWith(
      2,
      { kind: 'projects', ids: ['sodium', 'lithium'] },
      undefined,
    )
    expect(operations.queryModrinth).toHaveBeenNthCalledWith(
      3,
      { kind: 'versions', ids: ['version1', 'version2'] },
      undefined,
    )
    expect(operations.queryModrinth).toHaveBeenNthCalledWith(
      4,
      {
        kind: 'versions-by-hash',
        hashes: ['abc', 'def'],
        algorithm: 'sha512',
        latest: true,
        loaders: ['fabric'],
        gameVersions: ['1.21.1'],
        multiple: false,
      },
      undefined,
    )
    expect(operations.queryModrinth).toHaveBeenNthCalledWith(
      5,
      { kind: 'user', id: 'user-id', related: 'projects' },
      undefined,
    )
    expect(operations.queryModrinth).toHaveBeenNthCalledWith(
      6,
      { kind: 'authenticated-user' },
      undefined,
    )
    expect(operations.queryModrinth).toHaveBeenNthCalledWith(
      7,
      { kind: 'team', project: 'sodium' },
      undefined,
    )
  })

  test('dispatches the complete CurseForge API detail surface', async () => {
    const operations = createOperations()
    const command = getCommand('curseforge', operations)
    await command.execute(['project', '238222', '394468'])
    await command.execute(['file', '238222', '5535640'])
    await command.execute(['files-by-id', '5535640', '5535641'])
    await command.execute(['description', '238222'])
    await command.execute(['changelog', '238222', '5535640'])
    await command.execute(['fingerprints', '12345', '67890', '--fuzzy'])
    expect(operations.queryCurseforge).toHaveBeenNthCalledWith(
      1,
      { kind: 'projects', ids: [238222, 394468] },
      undefined,
    )
    expect(operations.queryCurseforge).toHaveBeenNthCalledWith(
      2,
      { kind: 'file', project: 238222, file: 5535640 },
      undefined,
    )
    expect(operations.queryCurseforge).toHaveBeenNthCalledWith(
      3,
      { kind: 'files', ids: [5535640, 5535641] },
      undefined,
    )
    expect(operations.queryCurseforge).toHaveBeenNthCalledWith(
      4,
      { kind: 'description', project: 238222 },
      undefined,
    )
    expect(operations.queryCurseforge).toHaveBeenNthCalledWith(
      5,
      { kind: 'changelog', project: 238222, file: 5535640 },
      undefined,
    )
    expect(operations.queryCurseforge).toHaveBeenNthCalledWith(
      6,
      { kind: 'fingerprints', fingerprints: [12345, 67890], fuzzy: true },
      undefined,
    )
  })

  test('dispatches paged provider searches and category discovery', async () => {
    const operations = createOperations()
    const modrinth = getCommand('modrinth', operations)
    const curseforge = getCommand('curseforge', operations)
    await modrinth.execute(['categories', '--type', 'mod'])
    await modrinth.execute([
      'search',
      'storage',
      '--type',
      'mod',
      '--category',
      'technology',
      '--category',
      'utility',
      '--license',
      'mit',
      '--environment',
      'client',
      '--index',
      'downloads',
      '--page',
      '3',
      '--limit',
      '5',
    ])
    await modrinth.execute(['search', 'storage', '--type', 'mod'])
    await curseforge.execute(['categories', '--class', '6'])
    await curseforge.execute([
      'search',
      'storage',
      '--class',
      '6',
      '--category',
      '423',
      '--slug',
      'storage',
      '--loader',
      'Fabric',
      '--game-version-type',
      '777',
      '--sort',
      '2',
      '--order',
      'asc',
      '--page',
      '2',
      '--limit',
      '10',
    ])
    expect(operations.getModrinthCategories).toHaveBeenCalledWith({ type: 'mod' }, undefined)
    expect(operations.searchModrinth).toHaveBeenCalledWith(
      {
        query: 'storage',
        type: 'mod',
        gameVersion: undefined,
        loader: undefined,
        all: false,
        categories: ['technology', 'utility'],
        license: 'mit',
        environment: 'client',
        index: 'downloads',
        limit: 5,
        page: 3,
      },
      undefined,
    )
    expect(operations.searchModrinth).toHaveBeenLastCalledWith(
      {
        query: 'storage',
        type: 'mod',
        gameVersion: undefined,
        loader: undefined,
        all: false,
        categories: [],
        license: undefined,
        environment: undefined,
        index: undefined,
        limit: 10,
        page: 1,
      },
      undefined,
    )
    expect(operations.getCurseforgeCategories).toHaveBeenCalledWith({ classId: 6 }, undefined)
    expect(operations.searchCurseforge).toHaveBeenCalledWith(
      {
        query: 'storage',
        gameVersion: undefined,
        classId: 6,
        category: 423,
        slug: 'storage',
        loaders: ['Fabric'],
        all: false,
        gameVersionType: 777,
        sort: 2,
        order: 'asc',
        limit: 10,
        page: 2,
      },
      undefined,
    )
  })

  test('uses --all only as an explicit unfiltered provider mode', async () => {
    const operations = createOperations()
    const modrinth = getCommand('modrinth', operations)
    const curseforge = getCommand('curseforge', operations)

    await modrinth.execute(['search', 'sodium', '--type', 'mod', '--all'])
    await modrinth.execute(['versions', 'sodium', '--all'])
    await curseforge.execute(['search', 'sodium', '--all'])
    await curseforge.execute(['files', '394468', '--all'])

    expect(operations.searchModrinth).toHaveBeenCalledWith(
      expect.objectContaining({ all: true }),
      undefined,
    )
    expect(operations.getModrinthVersions).toHaveBeenCalledWith(
      expect.objectContaining({ project: 'sodium', all: true }),
      undefined,
    )
    expect(operations.searchCurseforge).toHaveBeenCalledWith(
      expect.objectContaining({ all: true }),
      undefined,
    )
    expect(operations.getCurseforgeFiles).toHaveBeenCalledWith(
      expect.objectContaining({ project: 394468, all: true }),
      undefined,
    )
    await expect(
      modrinth.execute(['search', 'sodium', '--type', 'mod', '--all', '--loader', 'fabric']),
    ).rejects.toThrow('--all cannot be combined')
    await expect(
      curseforge.execute(['files', '394468', '--all', '--game-version', '1.21.1']),
    ).rejects.toThrow('--all cannot be combined')
  })

  test('requires and accepts an explicit Modrinth search project type', async () => {
    const operations = createOperations()
    const command = getCommand('modrinth', operations)

    for (const type of ['mod', 'resourcepack', 'shader', 'modpack', 'datapack']) {
      await command.execute(['search', 'example', '--type', type])
    }

    expect(vi.mocked(operations.searchModrinth).mock.calls.map(([input]) => input.type)).toEqual([
      'mod',
      'resourcepack',
      'shader',
      'modpack',
      'datapack',
    ])
    await expect(executeAgentRuntimeCommand(command, ['search', 'example'])).rejects.toThrow(
      'Usage: modrinth <resource> ...',
    )
  })

  test('dispatches confirmed Modrinth social mutations', async () => {
    const operations = createOperations()
    const command = getCommand('modrinth', operations)
    await command.execute(['follow', 'sodium'])
    await command.execute(['unfollow', 'sodium'])
    await command.execute([
      'collection',
      'create',
      'Performance',
      '--description',
      'Fast mods',
      '--project',
      'sodium',
      '--project',
      'lithium',
    ])
    await command.execute(['collection', 'add', 'collection-id', 'sodium'])
    await command.execute(['collection', 'remove', 'collection-id', 'sodium'])
    await command.execute(['collection', 'delete', 'collection-id'])
    expect(operations.mutateModrinth).toHaveBeenNthCalledWith(
      1,
      { kind: 'follow', project: 'sodium' },
      undefined,
    )
    expect(operations.mutateModrinth).toHaveBeenNthCalledWith(
      2,
      { kind: 'unfollow', project: 'sodium' },
      undefined,
    )
    expect(operations.mutateModrinth).toHaveBeenNthCalledWith(
      3,
      {
        kind: 'collection-create',
        name: 'Performance',
        description: 'Fast mods',
        projects: ['sodium', 'lithium'],
      },
      undefined,
    )
    expect(operations.mutateModrinth).toHaveBeenNthCalledWith(
      4,
      { kind: 'collection-add', collection: 'collection-id', project: 'sodium' },
      undefined,
    )
    expect(operations.mutateModrinth).toHaveBeenNthCalledWith(
      5,
      { kind: 'collection-remove', collection: 'collection-id', project: 'sodium' },
      undefined,
    )
    expect(operations.mutateModrinth).toHaveBeenNthCalledWith(
      6,
      { kind: 'collection-delete', collection: 'collection-id' },
      undefined,
    )
  })

  test('rejects invalid provider pages and categories', async () => {
    const operations = createOperations()
    const modrinth = getCommand('modrinth', operations)
    const curseforge = getCommand('curseforge', operations)
    await expect(modrinth.execute(['search', 'storage'])).rejects.toThrow('requires --type')
    await expect(
      modrinth.execute(['search', 'storage', '--type', 'mod', '--page', '0']),
    ).rejects.toThrow('--page must be a positive integer')
    await expect(curseforge.execute(['search', 'storage', '--category', 'mods'])).rejects.toThrow(
      'category id must be a positive integer',
    )
    await expect(modrinth.execute(['versions', 'sodium', '--fuzzy'])).rejects.toThrow(
      'does not accept --fuzzy',
    )
    await expect(modrinth.execute(['versions', 'sodium', '--compact'])).rejects.toThrow(
      'does not accept --compact',
    )
    await expect(modrinth.execute(['hash', 'abc', '--latest', '--multiple'])).rejects.toThrow(
      'cannot be combined',
    )
    await expect(curseforge.execute(['fingerprints', '12345', '--latest'])).rejects.toThrow(
      'does not accept --latest',
    )
  })

  test('allows queryless provider browsing', async () => {
    const operations = createOperations()
    await getCommand('modrinth', operations).execute(['search', '--type', 'mod', '--page', '2'])
    expect(operations.searchModrinth).toHaveBeenCalledWith(
      expect.objectContaining({ query: '', type: 'mod', page: 2 }),
      undefined,
    )
  })

  test('compacts Modrinth projects without dropping compatibility metadata', async () => {
    const project = {
      id: 'sodium',
      title: 'Sodium',
      description: 'x'.repeat(600),
      body: '# Sodium\nDonate and join Discord',
      gallery: [{ url: 'https://example.test/image.webp' }],
      featured_gallery: 'https://example.test/featured.webp',
      color: 123,
      monetization_status: 'monetized',
      thread_id: 'sodium',
      donation_urls: [{ platform: 'Patreon', url: 'https://example.test/donate' }],
      followers: 42,
      loaders: ['fabric'],
      game_versions: ['1.21.1'],
    }
    expect(compactModrinthProjectResult(project)).toEqual({
      id: 'sodium',
      title: 'Sodium',
      description: `${'x'.repeat(497)}...`,
      loaders: ['fabric'],
      game_versions: ['1.21.1'],
    })

    const operations = createOperations()
    vi.mocked(operations.queryModrinth).mockResolvedValue(project)
    await expect(
      getCommand('modrinth', operations).execute(['project', 'sodium', '--compact']),
    ).resolves.toEqual(compactModrinthProjectResult(project))
    await expect(getCommand('modrinth', operations).execute(['project', 'sodium'])).resolves.toBe(
      project,
    )
  })

  test('compacts CurseForge project files and screenshots', async () => {
    const project = {
      id: 238222,
      name: 'Just Enough Items',
      summary: 'Item and recipe viewing mod',
      screenshots: [
        {
          id: 1,
          description: 'Inventory',
          thumbnailUrl: 'https://example.test/thumb.png',
          url: 'https://example.test/full.png',
        },
      ],
      latestFilesIndexes: [{ fileId: 10, gameVersion: '1.21.1' }],
      latestFiles: [
        {
          id: 10,
          modId: 238222,
          displayName: 'JEI 1.21.1',
          fileName: 'jei.jar',
          gameVersions: ['1.21.1', 'NeoForge'],
          releaseType: 1,
          downloadUrl: 'https://example.test/jei.jar',
          hashes: [{ algo: 1, value: 'abc' }],
          modules: [{ name: 'META-INF', fingerprint: 1 }],
          fileLength: 123456,
          dependencies: [{ modId: 1, relationType: 3 }],
        },
      ],
    }
    expect(compactCurseforgeProjectResult(project)).toEqual({
      id: 238222,
      name: 'Just Enough Items',
      summary: 'Item and recipe viewing mod',
      screenshots: [{ url: 'https://example.test/full.png' }],
      latestFiles: [
        {
          displayName: 'JEI 1.21.1',
          fileName: 'jei.jar',
          gameVersions: ['1.21.1', 'NeoForge'],
          releaseType: 1,
          downloadUrl: 'https://example.test/jei.jar',
          dependencies: [{ modId: 1, relationType: 3 }],
          installRef: 'curseforge:238222/10',
        },
      ],
    })

    const operations = createOperations()
    vi.mocked(operations.queryCurseforge).mockResolvedValue(project)
    await expect(
      getCommand('curseforge', operations).execute(['project', '238222', '--compact']),
    ).resolves.toEqual(compactCurseforgeProjectResult(project))
  })

  test('filters provider noise from default discovery and file responses', async () => {
    const modrinthOperations = createOperations()
    vi.mocked(modrinthOperations.queryModrinth).mockResolvedValue([
      {
        name: 'forge',
        icon: '<svg><path d="large" /></svg>',
        supported_project_types: ['mod', 'modpack'],
      },
    ])
    await expect(
      getCommand('modrinth', modrinthOperations).execute(['tags', 'loaders']),
    ).resolves.toEqual([{ name: 'forge', supported_project_types: ['mod', 'modpack'] }])

    const curseforgeOperations = createOperations()
    vi.mocked(curseforgeOperations.getCurseforgeCategories).mockResolvedValue({
      source: 'curseforge',
      classId: 6,
      categories: [
        {
          id: 423,
          name: 'Map and Information',
          slug: 'map-information',
          classId: 6,
          parentCategoryId: 6,
          isClass: false,
        },
      ],
    })
    await expect(
      getCommand('curseforge', curseforgeOperations).execute(['categories', '--class', '6']),
    ).resolves.toEqual({
      source: 'curseforge',
      classId: 6,
      categories: [{ id: 423, name: 'Map and Information', slug: 'map-information' }],
    })

    const project = {
      id: 238222,
      name: 'Just Enough Items',
      gameVersions: ['1.21.1', 'NeoForge'],
      sortableGameVersions: [{ gameVersionName: '1.21.1', gameVersionPadded: '0000000021' }],
      latestFilesIndexes: [{ fileId: 10, gameVersion: '1.21.1' }],
      latestFiles: [
        {
          id: 10,
          modId: 238222,
          displayName: 'JEI',
          fileName: 'jei.jar',
          gameVersions: ['1.21.1'],
          releaseType: 1,
          downloadUrl: 'https://example.test/jei.jar',
          dependencies: [{ modId: 1, relationType: 3 }],
          modules: [{ name: 'META-INF', fingerprint: 1 }],
        },
      ],
    }
    const searchResult = { projects: [project], presentation: { type: 'market-project-list' } }
    vi.mocked(curseforgeOperations.searchCurseforge).mockResolvedValue(searchResult)
    await expect(
      getCommand('curseforge', curseforgeOperations).execute(['search', 'jei']),
    ).resolves.toEqual({
      projects: [
        {
          id: 238222,
          name: 'Just Enough Items',
          gameVersions: ['1.21.1', 'NeoForge'],
          latestFiles: [
            {
              displayName: 'JEI',
              fileName: 'jei.jar',
              gameVersions: ['1.21.1'],
              releaseType: 1,
              downloadUrl: 'https://example.test/jei.jar',
              dependencies: [{ modId: 1, relationType: 3 }],
              installRef: 'curseforge:238222/10',
            },
          ],
        },
      ],
      presentation: { type: 'market-project-list' },
    })

    const file = {
      id: 10,
      modId: 238222,
      fileName: 'jei.jar',
      downloadUrl: 'https://example.test/jei.jar',
      dependencies: [{ modId: 1 }],
      hashes: [{ value: 'abc' }],
      modules: [{ name: 'META-INF', fingerprint: 1 }],
    }
    vi.mocked(curseforgeOperations.queryCurseforge)
      .mockResolvedValueOnce(file)
      .mockResolvedValueOnce([file])
    const expectedFile = {
      id: 10,
      modId: 238222,
      fileName: 'jei.jar',
      downloadUrl: 'https://example.test/jei.jar',
      dependencies: [{ modId: 1 }],
      hashes: [{ value: 'abc' }],
    }
    await expect(
      getCommand('curseforge', curseforgeOperations).execute(['file', '238222', '10']),
    ).resolves.toEqual(expectedFile)
    await expect(
      getCommand('curseforge', curseforgeOperations).execute(['files-by-id', '10']),
    ).resolves.toEqual([expectedFile])
  })

  test('lists document ids and descriptions without eagerly loading provider guidance', () => {
    const prompt = buildAgentSystemPrompt({
      role: 'launcher-main',
      locale: 'English',
      tools: [{ name: 'vfs_shell' }],
      readonly: false,
      documents: [
        {
          id: 'shaderpack-enable',
          description:
            'Evaluate hardware, install compatible shader support, and enable the selected pack.',
        },
      ],
    })

    expect(prompt).toContain('not an operating-system shell')
    expect(prompt).toContain('cannot inspect launcher source code')
    expect(prompt).toContain('inspect its help and verify behavior with that command')
    expect(prompt).toContain('document search <keywords>')
    expect(prompt).toContain('document read <id>')
    expect(prompt).toContain('### Built-in documents')
    expect(prompt).toContain('- ID: shaderpack-enable')
    expect(prompt).toContain(
      '  Description: Evaluate hardware, install compatible shader support, and enable the selected pack.',
    )
    expect(prompt).not.toContain('Title:')
    expect(prompt).not.toContain('Tags:')
    expect(prompt).toContain('including documents not listed above')
    expect(prompt).toContain('never search implementation source')
    expect(prompt).toContain('Passive launcher context records')
    expect(prompt).not.toContain('modrinth')
    expect(prompt).not.toContain('curseforge')
    expect(prompt).not.toContain('installRef')
    expect(prompt).not.toContain('--compact')
  })

  test('registers full provider names only', () => {
    const commands = createAgentRuntimeCommands(createOperations())
    const names = commands.map((command) => command.name)
    expect(names).toContain('modrinth')
    expect(names).toContain('curseforge')
    expect(names).toContain('ls')
    expect(names).toContain('document')
    expect(names).not.toContain('market')
    expect(names).not.toContain('mr')
    expect(names).not.toContain('cf')
    expect(getCommand('modrinth', createOperations()).usage).toBe('modrinth <resource> ...')
    expect(
      getCommand('modrinth', createOperations()).details.every((detail) =>
        detail.startsWith('modrinth '),
      ),
    ).toBe(true)
    expect(getCommand('curseforge', createOperations()).usage).toBe('curseforge <resource> ...')
    expect(
      getCommand('curseforge', createOperations()).details.every((detail) =>
        detail.startsWith('curseforge '),
      ),
    ).toBe(true)
    expect(getCommand('ls', createOperations()).usage).toBe('ls [virtual-path]')
  })

  test('searches and reads built-in workflow documents', async () => {
    const operations = createOperations()
    const command = getCommand('document', operations)

    await expect(command.execute(['list'])).resolves.toEqual({
      documents: [expect.objectContaining({ id: 'shaderpack-enable' })],
    })
    await expect(command.execute(['search', 'shader', 'gpu'])).resolves.toMatchObject({
      query: 'shader gpu',
      documents: [expect.objectContaining({ id: 'shaderpack-enable' })],
    })
    await expect(command.execute(['read', 'shaderpack-enable'])).resolves.toMatchObject({
      id: 'shaderpack-enable',
      body: expect.stringContaining('enableShaders=true'),
    })
  })

  test('resolves declared runtime aliases through one command index', async () => {
    const operations = createOperations()
    const commands = createAgentRuntimeCommands(operations)
    const index = createAgentRuntimeCommandIndex(commands)

    expect(index.get('vfs_list')).toBe(index.get('ls'))
    expect(index.get('vfs_read')).toBe(index.get('cat'))
    expect(index.get('vfs_rm')).toBe(index.get('rm'))
    await index.get('vfs_list')!.execute([])
    expect(operations.listVfs).toHaveBeenCalledWith('', undefined)
    expect(() =>
      createAgentRuntimeCommandIndex([
        ...commands,
        { ...index.get('ls')!, name: 'vfs_list', aliases: [] },
      ]),
    ).toThrow('Duplicate Agent runtime command name: vfs_list')
  })

  test('accepts native VFS tool calls in virtual-shell form', async () => {
    const operations = createOperations()
    const index = createAgentRuntimeCommandIndex(createAgentRuntimeCommands(operations))

    await index
      .get('vfs_read')!
      .execute(['config/iris.properties', '--tail-lines', '50', '--offset', '10', '--limit', '200'])
    expect(operations.readVfs).toHaveBeenCalledWith(
      {
        path: 'config/iris.properties',
        tailLines: 50,
        offset: 10,
        limit: 200,
      },
      undefined,
    )

    await index.get('vfs_rm')!.execute(['--paths', 'mods/old.jar,mods/older.jar'])
    expect(operations.removeVfs).toHaveBeenCalledWith(['mods/old.jar', 'mods/older.jar'], undefined)
  })

  test('uses version-metadata for read-only Minecraft and loader discovery', async () => {
    const operations = createOperations()
    const index = createAgentRuntimeCommandIndex(createAgentRuntimeCommands(operations))
    const command = index.get('version-metadata')!

    expect(index.has('loader')).toBe(false)
    await command.execute(['minecraft'])
    await command.execute(['minecraft', '--type', 'snapshot', '--limit', '12', '--refresh'])
    await command.execute(['loader', 'neoforge', '--game-version', '26.1.2'])
    await command.execute(['loader', 'fabric', '1.21.1', '--limit', '20', '--refresh'])

    expect(operations.listMinecraftMetadata).toHaveBeenNthCalledWith(1, {
      type: undefined,
      limit: 25,
      refresh: false,
    }, undefined)
    expect(operations.listMinecraftMetadata).toHaveBeenNthCalledWith(2, {
      type: 'snapshot',
      limit: 12,
      refresh: true,
    }, undefined)
    expect(operations.listLoaderMetadata).toHaveBeenNthCalledWith(
      1,
      {
        loader: 'neoforge',
        minecraft: '26.1.2',
        limit: 10,
        refresh: false,
      },
      undefined,
    )
    expect(operations.listLoaderMetadata).toHaveBeenNthCalledWith(
      2,
      {
        loader: 'fabric',
        minecraft: '1.21.1',
        limit: 20,
        refresh: true,
      },
      undefined,
    )
    await expect(command.execute(['loader'])).rejects.toThrow('requires a loader')
    await expect(command.execute(['minecraft', '--type', 'beta'])).rejects.toThrow('Unknown Minecraft version type: beta')
  })

  test('uses version for locally installed client and server versions', async () => {
    const operations = createOperations()
    const command = getCommand('version', operations)

    await command.execute(['list', '--refresh'])
    await command.execute(['list', '--server'])
    await command.execute(['info', '1.21.1-neoforge', '--server'])
    await command.execute(['refresh', '1.21.1'])
    await command.execute(['delete', 'old-version'])
    await command.execute(['open'])

    expect(operations.listLocalVersions).toHaveBeenNthCalledWith(1, { server: false, refresh: true }, undefined)
    expect(operations.listLocalVersions).toHaveBeenNthCalledWith(2, { server: true, refresh: false }, undefined)
    expect(operations.getLocalVersion).toHaveBeenCalledWith({ id: '1.21.1-neoforge', server: true }, undefined)
    expect(operations.refreshLocalVersions).toHaveBeenCalledWith({ id: '1.21.1', server: false }, undefined)
    expect(operations.deleteLocalVersion).toHaveBeenCalledWith({ id: 'old-version' }, undefined)
    expect(operations.openLocalVersion).toHaveBeenCalledWith({ id: undefined }, undefined)
  })

  test('parses atomic instance runtime changes', async () => {
    const operations = createOperations()
    const command = getCommand('instance', operations)

    await command.execute(['runtime', 'show'])
    await command.execute([
      'runtime',
      'set',
      '--minecraft',
      '1.21.1',
      '--loader',
      'neoforge',
      '--loader-version',
      '21.1.200',
    ])
    await command.execute(['runtime', 'set', '--minecraft', '1.21.1', '--no-loader'])

    expect(operations.getInstanceRuntime).toHaveBeenCalledWith(undefined)
    expect(operations.setInstanceRuntime).toHaveBeenNthCalledWith(1, {
      minecraft: '1.21.1',
      loader: 'neoforge',
      loaderVersion: '21.1.200',
      noLoader: false,
    }, undefined)
    expect(operations.setInstanceRuntime).toHaveBeenNthCalledWith(2, {
      minecraft: '1.21.1',
      loader: undefined,
      loaderVersion: undefined,
      noLoader: true,
    }, undefined)

    await expect(command.execute(['runtime', 'set', '--loader', 'fabric'])).rejects.toThrow(
      '--loader and --loader-version must be specified together',
    )
    await expect(command.execute(['runtime', 'set', '--no-loader', '--loader', 'fabric', '--loader-version', '0.16.10'])).rejects.toThrow(
      '--no-loader cannot be combined',
    )
  })

  test('dispatches user and java commands', async () => {
    const operations = createOperations()
    await getCommand('user', operations).execute(['list'])
    await getCommand('user', operations).execute(['select', 'Alex'])
    await getCommand('java', operations).execute(['diagnose'])
    await getCommand('java', operations).execute(['list', '--refresh'])
    await getCommand('java', operations).execute(['select', 'C:/Java/bin/java.exe'])
    await getCommand('java', operations).execute(['select', 'auto'])
    await getCommand('java', operations).execute(['install', '--zulu'])
    expect(operations.listAccounts).toHaveBeenCalledOnce()
    expect(operations.selectAccount).toHaveBeenCalledWith({ ref: 'Alex' }, undefined)
    expect(operations.diagnoseJava).toHaveBeenCalledOnce()
    expect(operations.listJava).toHaveBeenCalledWith({ refresh: true }, undefined)
    expect(operations.selectJava).toHaveBeenNthCalledWith(
      1,
      { path: 'C:/Java/bin/java.exe' },
      undefined,
    )
    expect(operations.selectJava).toHaveBeenNthCalledWith(2, { path: undefined }, undefined)
    expect(operations.installJava).toHaveBeenCalledWith({ forceZulu: true }, undefined)
  })

  test('dispatches mod commands and options', async () => {
    const operations = createOperations()
    const command = getCommand('mod', operations)
    await command.execute(['dependencies', 'check'])
    await command.execute(['dependencies', 'install'])
    await command.execute(['unused', 'scan'])
    await command.execute(['update', 'check'])
    await command.execute(['update', 'check', '--policy', 'curseforgeOnly', '--skip-version'])
    await command.execute(['update', 'stage'])
    expect(operations.checkModDependencies).toHaveBeenCalledOnce()
    expect(operations.installModDependencies).toHaveBeenCalledOnce()
    expect(operations.scanUnusedMods).toHaveBeenCalledOnce()
    expect(operations.checkModUpdates).toHaveBeenNthCalledWith(
      1,
      { policy: undefined, skipVersion: undefined },
      undefined,
    )
    expect(operations.checkModUpdates).toHaveBeenNthCalledWith(
      2,
      { policy: 'curseforgeOnly', skipVersion: true },
      undefined,
    )
    expect(operations.stageModUpdates).toHaveBeenCalledOnce()
  })

  test('dispatches world commands and flags', async () => {
    const operations = createOperations()
    const command = getCommand('world', operations)
    await command.execute(['import', 'C:/world.zip', '--name', 'Imported'])
    await command.execute(['export', 'Survival', 'C:/backup', '--directory'])
    await command.execute([
      'clone',
      'Survival',
      '--name',
      'Copy',
      '--to-instance',
      'C:/instances/target',
    ])
    await command.execute(['link-server', 'Survival'])
    expect(operations.importWorld).toHaveBeenCalledWith(
      { path: 'C:/world.zip', name: 'Imported' },
      undefined,
    )
    expect(operations.exportWorld).toHaveBeenCalledWith(
      { world: 'Survival', destination: 'C:/backup', zip: false },
      undefined,
    )
    expect(operations.cloneWorld).toHaveBeenCalledWith(
      { world: 'Survival', name: 'Copy', destination: 'C:/instances/target' },
      undefined,
    )
    expect(operations.linkWorldAsServer).toHaveBeenCalledWith({ world: 'Survival' }, undefined)
  })

  test('dispatches instance commands and runtime flags', async () => {
    const operations = createOperations()
    const command = getCommand('instance', operations)
    await command.execute(['list'])
    await command.execute(['create', 'Forge', '--minecraft', '1.20.1', '--forge', '47.3.0'])
    await command.execute(['diagnose'])
    await command.execute(['install'])
    await command.execute(['repair'])
    await command.execute(['manifest', 'status'])
    await command.execute(['manifest', 'apply'])
    await command.execute(['manifest', 'discard'])
    await command.execute(['duplicate'])
    await command.execute(['delete', 'C:/instances/old', '--delete-data'])
    await command.execute(['import', 'C:/packs/example.mrpack'])
    expect(operations.listInstances).toHaveBeenCalledOnce()
    expect(operations.createInstance).toHaveBeenCalledWith(
      {
        name: 'Forge',
        description: undefined,
        runtime: { minecraft: '1.20.1', forge: '47.3.0' },
      },
      undefined,
    )
    expect(operations.diagnoseInstance).toHaveBeenCalledOnce()
    expect(operations.installInstance).toHaveBeenCalledOnce()
    expect(operations.repairInstance).toHaveBeenCalledOnce()
    expect(operations.getInstanceManifest).toHaveBeenCalledOnce()
    expect(operations.applyInstanceManifest).toHaveBeenCalledOnce()
    expect(operations.discardInstanceManifest).toHaveBeenCalledOnce()
    expect(operations.duplicateInstance).toHaveBeenCalledWith({ source: undefined }, undefined)
    expect(operations.deleteInstance).toHaveBeenCalledWith(
      { target: 'C:/instances/old', deleteData: true },
      undefined,
    )
    expect(operations.importModpack).toHaveBeenCalledWith(
      { path: 'C:/packs/example.mrpack' },
      undefined,
    )
  })

  test('rejects invalid management syntax', async () => {
    const operations = createOperations()
    await expect(
      getCommand('mod', operations).execute(['update', 'check', '--policy', 'unknown']),
    ).rejects.toThrow('Unknown mod update policy')
    await expect(getCommand('world', operations).execute(['export', 'Survival'])).rejects.toThrow(
      'requires a world and destination',
    )
    await expect(
      getCommand('instance', operations).execute(['create', 'Forge', '--forge', '47.3.0']),
    ).rejects.toThrow('--minecraft is required')
  })
})

describe('VFS helper and process virtual shell commands', () => {
  test('redirects ls to the VFS list handler', async () => {
    const operations = createOperations()
    await getCommand('ls', operations).execute([])
    await getCommand('ls', operations).execute(['mods'])

    expect(operations.listVfs).toHaveBeenNthCalledWith(1, '', undefined)
    expect(operations.listVfs).toHaveBeenNthCalledWith(2, 'mods', undefined)
    await expect(getCommand('ls', operations).execute(['mods', 'extra'])).rejects.toThrow(
      'ls accepts at most one virtual path',
    )
  })

  test('dispatches grep and mv', async () => {
    const operations = createOperations()
    await getCommand('grep', operations).execute([
      '-i',
      'enabled=.*',
      'artifacts/result.json',
      '--offset',
      '25',
      '--limit',
      '50',
    ])
    await getCommand('mv', operations).execute(['mods/example.jar', 'mods/example.jar.disabled'])
    expect(operations.grepConfig).toHaveBeenCalledWith(
      {
        pattern: 'enabled=.*',
        path: 'artifacts/result.json',
        ignoreCase: true,
        offset: 25,
        limit: 50,
      },
      undefined,
    )
    expect(operations.moveResource).toHaveBeenCalledWith(
      { source: 'mods/example.jar', destination: 'mods/example.jar.disabled' },
      undefined,
    )
  })

  test('reports unsupported grep short options directly', async () => {
    const operations = createOperations()
    await expect(
      getCommand('grep', operations).execute(['-n', 'enabled=.*', 'artifacts/result.json']),
    ).rejects.toThrow('Unknown option: -n')
  })

  test('dispatches restricted server mod copies', async () => {
    const operations = createOperations()
    await getCommand('cp', operations).execute(['mods/a.jar', 'mods/b.jar', 'server/mods/'])
    expect(operations.deployServerMods).toHaveBeenCalledWith(
      {
        compatible: false,
        paths: ['mods/a.jar', 'mods/b.jar'],
      },
      undefined,
    )
    await expect(
      getCommand('cp', operations).execute(['config/a.txt', 'server/mods/']),
    ).rejects.toThrow('only supports installed mod paths')
  })

  test('dispatches launch and kill', async () => {
    const operations = createOperations()
    await getCommand('launch', operations).execute([])
    await getCommand('kill', operations).execute(['--force'])
    expect(operations.launchGame).toHaveBeenCalledOnce()
    expect(operations.stopGame).toHaveBeenCalledWith({ force: true }, undefined)
  })

  test('dispatches UI navigation', async () => {
    const operations = createOperations()
    await getCommand('ui', operations).execute(['navigate', '/instance/settings'])
    expect(operations.navigateUi).toHaveBeenCalledWith({ path: '/instance/settings' }, undefined)
  })

  test('rejects unsupported helper syntax', async () => {
    const operations = createOperations()
    await expect(getCommand('mv', operations).execute(['mods/a.jar'])).rejects.toThrow(
      'requires a source and destination',
    )
    await expect(getCommand('launch', operations).execute(['other-instance'])).rejects.toThrow(
      'Agent scope is fixed',
    )
  })
})
