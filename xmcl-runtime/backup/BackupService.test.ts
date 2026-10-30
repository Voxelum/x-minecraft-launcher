import {
  CURRENT_COLLECTION_SCHEMA_VERSION,
  LocalCollectionState,
  Settings,
} from '@xmcl/runtime-api'
import { ensureDir, mkdtemp, realpath, readFile, readJson, rm, writeFile, writeJson } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { open, readAllEntries } from '@xmcl/unzip'
import { kRestoreMaintenance } from './restoreMaintenance'
import { RestoreTransaction } from './restoreTransaction'

vi.mock('~/app', () => ({
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
  Inject: () => () => { },
  LauncherApp: class { },
}))

vi.mock('~/service', () => {
  const { join: joinPath } = require('path')
  return {
    ExposeServiceKey: () => () => { },
    Singleton: () => () => { },
    ServiceStateManager: class { },
    StatefulService: class {
      app: any
      state: any
      constructor(app: any, createState: () => any) {
        this.app = app
        this.state = createState ? createState() : {}
      }
      getAppDataPath = (...args: string[]) => joinPath(this.app.appDataPath, ...args)
      log = () => { }
      warn = () => { }
      error = () => { }
    },
    AbstractService: class {
      app: any
      constructor(app: any) {
        this.app = app
      }
      initialize = async () => {}
      emit = (event: string, ...args: any[]) => true
      getAppDataPath = (...args: string[]) => joinPath(this.app.appDataPath, ...args)
      log = () => { }
      warn = () => { }
      error = () => { }
    },
  }
})

const { BackupService } = await import('./BackupService')
type BackupService = InstanceType<typeof BackupService>

describe('BackupService', () => {
  let tempDir: string
  let appDataDir: string
  let gameDataDir: string
  let mockApp: any
  let mockInstanceService: any
  let mockThemeService: any
  let mockCollectionService: any
  let mockSettingsState: any
  let backupService: BackupService

  beforeEach(async () => {
    tempDir = await realpath(await mkdtemp(join(tmpdir(), 'xmcl-backup-test-')))
    appDataDir = join(tempDir, 'appData')
    gameDataDir = join(tempDir, 'gameData')
    await ensureDir(appDataDir)
    await ensureDir(gameDataDir)

    mockSettingsState = new Settings()
    mockApp = {
      appDataPath: appDataDir,
      version: '0.45.0',
      registryDisposer: vi.fn(),
      registry: {
        get: vi.fn().mockImplementation((key) => {
          return Promise.resolve(key === kRestoreMaintenance ? maintenance : mockSettingsState)
        }),
      },
    }

    mockInstanceService = {
      loadInstance: vi.fn().mockResolvedValue(true),
    }

    mockThemeService = {
      setCurrentTheme: vi.fn().mockResolvedValue(undefined),
    }

    mockCollectionService = {
      state: {
        collections: [],
        collectionUpsert: vi.fn(),
      },
    }

    const maintenance = { enter: async () => {
      const oldSettings = JSON.parse(JSON.stringify(mockSettingsState))
      const oldCollections = [...mockCollectionService.state.collections]
      return {
        prepareInstances: async (instances: any[]) => Buffer.from(JSON.stringify({ instances: instances.map(i => i.path), groups: [], selectedInstance: '' })),
        publish: async (plan: any) => {
          if (plan.settings) mockSettingsState.config(plan.settings)
          if (plan.collections) {
            mockCollectionService.state.collections = plan.collections.collections
            for (const c of plan.collections.collections) mockCollectionService.state.collectionUpsert(c)
          }
        },
        undoPublish: async () => { mockSettingsState.config(oldSettings); mockCollectionService.state.collections = oldCollections },
        release: async () => {},
      }
    } }
    const getPath = (...args: string[]) => join(gameDataDir, ...args)

    backupService = new BackupService(
      mockApp,
      mockInstanceService,
      getPath,
      mockThemeService,
      mockCollectionService,
    )
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  test('creates a backup with settings, collections, themes and excludes libraries/assets', async () => {
    // 1. Setup mock setting.json
    await writeJson(join(appDataDir, 'setting.json'), { locale: 'en' })

    // 2. Setup mock collections.json
    await writeJson(join(appDataDir, 'collections.json'), {
      schemaVersion: CURRENT_COLLECTION_SCHEMA_VERSION,
      collections: [
        {
          id: 'col-1',
          name: 'My Collection',
          description: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          entries: [],
        },
      ],
    })

    // 3. Setup mock theme
    await writeJson(join(appDataDir, 'theme.json'), {
      ui: 'default',
      version: 1,
      assets: {},
    })
    await writeFile(join(appDataDir, 'theme.css'), 'body { background: red; }')
    const mediaDir = join(appDataDir, 'theme-media')
    await ensureDir(mediaDir)
    await writeFile(join(mediaDir, 'wallpaper.png'), 'image-bytes')

    // 4. Setup mock instance
    const instDir = join(gameDataDir, 'instances', 'TestInstance')
    await ensureDir(instDir)
    await writeJson(join(instDir, 'instance.json'), {
      name: 'TestInstance',
      runtime: { minecraft: '1.20.1', fabricLoader: '0.15.11' },
    })
    // Configs
    const configDir = join(instDir, 'config')
    await ensureDir(configDir)
    await writeFile(join(configDir, 'test.cfg'), 'some-config')
    await writeFile(join(instDir, 'options.txt'), 'gamma:1.0')

    // Saves
    const savesDir = join(instDir, 'saves', 'World1')
    await ensureDir(savesDir)
    await writeFile(join(savesDir, 'level.dat'), 'save-bytes')

    // Mods
    const modsDir = join(instDir, 'mods')
    await ensureDir(modsDir)
    await writeFile(join(modsDir, 'mod-a.jar'), 'mod-bytes')

    // Libraries & Assets (MUST BE EXCLUDED!)
    const libsDir = join(instDir, 'libraries', 'net', 'fabricmc')
    await ensureDir(libsDir)
    await writeFile(join(libsDir, 'dummy.jar'), 'lib-bytes')

    const assetsDir = join(instDir, 'assets', 'objects')
    await ensureDir(assetsDir)
    await writeFile(join(assetsDir, 'dummy.asset'), 'asset-bytes')

    // Logs (MUST BE EXCLUDED!)
    const logsDir = join(instDir, 'logs')
    await ensureDir(logsDir)
    await writeFile(join(logsDir, 'latest.log'), 'log-bytes')

    // Perform backup
    const backupFile = join(tempDir, 'my-backup.xmclbackup')
    const createdPath = await backupService.createBackup({
      destinationPath: backupFile,
      includeSettings: true,
      includeCollections: true,
      includeThemes: true,
      instances: [
        {
          instancePath: instDir,
          includeConfigs: true,
          includeSaves: true,
          includeMods: true,
          modListOnly: false,
        },
      ],
    })

    expect(createdPath).toBe(backupFile)

    // Verify manifest
    const manifest = await backupService.loadBackupManifest(backupFile)
    expect(manifest.version).toBe(1)
    expect(manifest.appVersion).toBe('0.45.0')
    expect(manifest.includes.settings).toBe(true)
    expect(manifest.includes.collections).toBe(true)
    expect(manifest.includes.themes).toBe(true)
    expect(manifest.includes.instances).toHaveLength(1)
    expect(manifest.includes.instances[0].name).toBe('TestInstance')
    expect(manifest.includes.instances[0].mcVersion).toBe('1.20.1')
    expect(manifest.includes.instances[0].loader).toBe('Fabric 0.15.11')
    expect(manifest.includes.instances[0].modsCount).toBe(1)

    // Inspect zip contents
    const zip = await open(backupFile)
    const entries = await readAllEntries(zip)
    const entryNames = entries.map((e) => e.fileName)

    expect(entryNames).toContain('manifest.json')
    expect(entryNames).toContain('settings/setting.json')
    expect(entryNames).toContain('collections/collections.json')
    expect(entryNames).toContain('themes/theme.json')
    expect(entryNames).toContain('themes/theme.css')
    expect(entryNames).toContain('themes/theme-media/wallpaper.png')

    // Instance files included
    expect(entryNames).toContain('instances/TestInstance/instance.json')
    expect(entryNames).toContain('instances/TestInstance/options.txt')
    expect(entryNames).toContain('instances/TestInstance/config/test.cfg')
    expect(entryNames).toContain('instances/TestInstance/saves/World1/level.dat')
    expect(entryNames).toContain('instances/TestInstance/mods/mod-a.jar')
    expect(entryNames).toContain('instances/TestInstance/mods-list.json')

    // CRITICAL: libraries, assets, and logs MUST NOT be present
    expect(entryNames.some((n) => n.includes('libraries'))).toBe(false)
    expect(entryNames.some((n) => n.includes('assets'))).toBe(false)
    expect(entryNames.some((n) => n.includes('logs'))).toBe(false)
  })

  test('restores settings, collections, themes, and instances', async () => {
    // Create minimal backup
    await writeJson(join(appDataDir, 'setting.json'), { locale: 'uk' })
    await writeJson(join(appDataDir, 'collections.json'), {
      schemaVersion: CURRENT_COLLECTION_SCHEMA_VERSION,
      collections: [
        {
          id: 'col-restore',
          name: 'Restored Collection',
          description: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          entries: [],
        },
      ],
    })

    const instDir = join(gameDataDir, 'instances', 'SourceInst')
    await ensureDir(instDir)
    await writeJson(join(instDir, 'instance.json'), {
      name: 'SourceInst',
      runtime: { minecraft: '1.20.1' },
    })

    const backupFile = join(tempDir, 'restore-test.xmclbackup')
    await backupService.createBackup({
      destinationPath: backupFile,
      includeSettings: true,
      includeCollections: true,
      instances: [
        {
          instancePath: instDir,
          includeConfigs: true,
        },
      ],
    })

    // Now restore
    const restoreResult = await backupService.restoreBackup({
      backupPath: backupFile,
      restoreSettings: true,
      restoreCollections: true,
      instances: ['SourceInst'],
      instanceConflictStrategy: 'rename',
    })

    expect(restoreResult.restoredSettings).toBe(true)
    expect(restoreResult.restoredCollections).toBe(true)
    expect(restoreResult.restoredInstances).toHaveLength(1)
    expect(restoreResult.skippedInstances).toEqual([])
    expect(mockCollectionService.state.collectionUpsert).toHaveBeenCalled()
    expect(mockInstanceService.loadInstance).not.toHaveBeenCalled()
    expect(await readJson(join(restoreResult.restoredInstances[0], 'instance.json'))).toMatchObject({ name: 'SourceInst (Restored)' })
    expect(await readJson(join(appDataDir, 'setting.json'))).toMatchObject({ locale: 'uk' })

    // Test conflictStrategy: 'skip'
    const skipResult = await backupService.restoreBackup({
      backupPath: backupFile,
      instances: ['SourceInst'],
      instanceConflictStrategy: 'skip',
    })
    expect(skipResult.restoredInstances).toHaveLength(0)
    expect(skipResult.skippedInstances).toEqual(['SourceInst'])
  })

  test('overwrite retains unselected categories and transaction publication failure restores bytes', async () => {
    const inst = join(gameDataDir, 'instances', 'Demo')
    await ensureDir(join(inst, 'config'))
    await ensureDir(join(inst, 'saves', 'world'))
    await writeJson(join(inst, 'instance.json'), { name: 'Demo', runtime: { minecraft: '1.20.1' } })
    await writeFile(join(inst, 'config', 'demo.cfg'), 'ARCHIVED')
    const archive = join(tempDir, 'overwrite.xmclbackup')
    await backupService.createBackup({ destinationPath: archive, instances: [{ instancePath: inst, includeConfigs: true }] })
    await writeFile(join(inst, 'config', 'demo.cfg'), 'ORIGINAL')
    await writeFile(join(inst, 'saves', 'world', 'level.dat'), 'UNSELECTED WORLD')
    const originalJSON = await readFile(join(inst, 'instance.json'))
    const prepare = RestoreTransaction.prepare
    const spy = vi.spyOn(RestoreTransaction, 'prepare').mockImplementation((root, inputs) => prepare(root, inputs, point => {
      if (point === 'publish-after') throw new Error('injected publish failure')
    }))
    await expect(backupService.restoreBackup({ backupPath: archive, instances: ['Demo'], instanceConflictStrategy: 'overwrite' })).rejects.toThrow('injected publish failure')
    expect(await readFile(join(inst, 'config', 'demo.cfg'), 'utf8')).toBe('ORIGINAL')
    expect(await readFile(join(inst, 'instance.json'))).toEqual(originalJSON)
    expect(await readFile(join(inst, 'saves', 'world', 'level.dat'), 'utf8')).toBe('UNSELECTED WORLD')
    spy.mockRestore()
    await backupService.restoreBackup({ backupPath: archive, instances: ['Demo'], instanceConflictStrategy: 'overwrite' })
    expect(await readFile(join(inst, 'config', 'demo.cfg'), 'utf8')).toBe('ARCHIVED')
    expect(await readFile(join(inst, 'saves', 'world', 'level.dat'), 'utf8')).toBe('UNSELECTED WORLD')
  })

  test('RPC cancellation during staging preserves original bytes; commit refuses cancellation', async () => {
    const inst = join(gameDataDir, 'instances', 'Demo')
    await ensureDir(inst)
    await writeJson(join(inst, 'instance.json'), { name: 'Demo' })
    await writeFile(join(inst, 'config.txt'), 'ARCHIVED')
    const archive = join(tempDir, 'cancel.xmclbackup')
    await backupService.createBackup({ destinationPath: archive, instances: [{ instancePath: inst, includeConfigs: true }] })
    await writeFile(join(inst, 'config.txt'), 'ORIGINAL')
    const prepare = RestoreTransaction.prepare
    const spy = vi.spyOn(RestoreTransaction, 'prepare').mockImplementation((root, inputs, fault) => prepare(root, inputs, async (point, index) => {
      if (point === 'staging-after' && index === 0) expect(await backupService.cancelBackupOperation()).toBe(true)
      await fault?.(point, index)
    }))
    await expect(backupService.restoreBackup({ backupPath: archive, instances: ['Demo'], instanceConflictStrategy: 'overwrite' })).rejects.toThrow('cancelled')
    expect(await readFile(join(inst, 'config.txt'), 'utf8')).toBe('ORIGINAL')
    spy.mockRestore()
    const commitSpy = vi.spyOn(RestoreTransaction, 'prepare').mockImplementation((root, inputs, fault) => prepare(root, inputs, async (point, index) => {
      if (point === 'old-before') expect(await backupService.cancelBackupOperation()).toBe(false)
      await fault?.(point, index)
    }))
    await backupService.restoreBackup({ backupPath: archive, instances: ['Demo'], instanceConflictStrategy: 'overwrite' })
    expect(await readFile(join(inst, 'config.txt'), 'utf8')).toBe('ARCHIVED')
    expect(await backupService.cancelBackupOperation()).toBe(false)
    commitSpy.mockRestore()
  })

  test('all archive mutations share the exclusive gate without nested auto-backup deadlock', async () => {
    const service = backupService as any
    const events: string[] = []
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    service.createBackupInternal = async () => { events.push('create-start'); await held; events.push('create-end'); return 'created' }
    service.deleteAutoBackupInternal = async () => { events.push('delete') }
    const create = backupService.createBackup({ destinationPath: 'unused' })
    const remove = backupService.deleteAutoBackup('unused')
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(events).toEqual(['create-start'])
    release(); await Promise.all([create, remove])
    expect(events).toEqual(['create-start', 'create-end', 'delete'])
  })

  test('backup refuses existing destination and preserves its bytes', async () => {
    const path = join(tempDir, 'existing.xmclbackup')
    await writeFile(path, 'ORIGINAL')
    await expect(backupService.createBackup({ destinationPath: path })).rejects.toThrow('already exists')
    expect(await readFile(path, 'utf8')).toBe('ORIGINAL')
  })

  test('respects modListOnly option', async () => {
    const instDir = join(gameDataDir, 'instances', 'ModListOnlyInst')
    await ensureDir(instDir)
    await writeJson(join(instDir, 'instance.json'), {
      name: 'ModListOnlyInst',
      runtime: { minecraft: '1.20.1' },
    })

    const modsDir = join(instDir, 'mods')
    await ensureDir(modsDir)
    await writeFile(join(modsDir, 'heavy-mod.jar'), 'large-mod-content')

    const backupFile = join(tempDir, 'mod-list-only.xmclbackup')
    await backupService.createBackup({
      destinationPath: backupFile,
      instances: [
        {
          instancePath: instDir,
          includeMods: true,
          modListOnly: true,
        },
      ],
    })

    const manifest = await backupService.loadBackupManifest(backupFile)
    expect(manifest.includes.instances[0].modListOnly).toBe(true)
    expect(manifest.includes.instances[0].modsCount).toBe(1)

    const zip = await open(backupFile)
    const entries = await readAllEntries(zip)
    const entryNames = entries.map((e) => e.fileName)

    // mods-list.json is present, but heavy-mod.jar is NOT packed into zip!
    expect(entryNames).toContain('instances/ModListOnlyInst/mods-list.json')
    expect(entryNames).not.toContain('instances/ModListOnlyInst/mods/heavy-mod.jar')
  })

  test('throws on nonexistent backup file or invalid manifest', async () => {
    await expect(backupService.loadBackupManifest(join(tempDir, 'does-not-exist.zip'))).rejects.toThrow()
  })

  test('safely handles broken symlinks/junctions and emits granular progress counts', async () => {
    const instDir = join(gameDataDir, 'instances', 'JunctionInst')
    await ensureDir(instDir)
    await writeJson(join(instDir, 'instance.json'), {
      name: 'JunctionInst',
      runtime: { minecraft: '1.20.4' },
    })
    const modsDir = join(instDir, 'mods')
    await ensureDir(modsDir)
    await writeFile(join(modsDir, 'test-mod.jar'), 'mod')

    const savesDir = join(instDir, 'saves', 'World1')
    await ensureDir(savesDir)
    await writeFile(join(savesDir, 'level.dat'), 'dat')

    // Create a broken symlink or junction
    const serverDir = join(instDir, 'server')
    await ensureDir(serverDir)
    try {
      const { symlink } = await import('fs-extra')
      await symlink(join(tempDir, 'nonexistent-target'), join(serverDir, 'config'), 'dir')
    } catch {
      // If symlink privileges are restricted, ignore
    }

    const emittedEvents: any[] = []
    backupService.emit = ((event: string, payload: any) => {
      if (event === 'backup-progress') {
        emittedEvents.push(payload)
      }
      return true
    }) as any

    const backupFile = join(tempDir, 'junction-test.xmclbackup')
    const dest = await backupService.createBackup({
      destinationPath: backupFile,
      instances: [
        {
          instancePath: instDir,
          includeConfigs: true,
          includeSaves: true,
          includeMods: true,
        },
      ],
    })

    expect(dest).toBe(backupFile)
    const lastEvent = emittedEvents[emittedEvents.length - 1]
    expect(lastEvent.phase).toBe('complete')
    expect(lastEvent.counts).toBeDefined()
    expect(lastEvent.counts.saves.total).toBe(1)
    expect(lastEvent.counts.mods.total).toBe(1)
  })

  test('strictly excludes Bedrock edition instances from backup', async () => {
    const bedrockDir = join(gameDataDir, 'instances', 'BedrockInst')
    await ensureDir(bedrockDir)
    await writeJson(join(bedrockDir, 'instance.json'), {
      name: 'BedrockInst',
      edition: 'bedrock',
      runtime: { minecraft: '1.20.0' },
    })
    const modsDir = join(bedrockDir, 'mods')
    await ensureDir(modsDir)
    await writeFile(join(modsDir, 'bedrock-mod.jar'), 'content')

    const backupFile = join(tempDir, 'bedrock-excluded.xmclbackup')
    await backupService.createBackup({
      destinationPath: backupFile,
      instances: [
        {
          instancePath: bedrockDir,
          includeMods: true,
        },
      ],
    })

    const manifest = await backupService.loadBackupManifest(backupFile)
    expect(manifest.includes.instances).toHaveLength(0)

    const zip = await open(backupFile)
    const entries = await readAllEntries(zip)
    const hasBedrock = entries.some((e) => e.fileName.includes('BedrockInst'))
    expect(hasBedrock).toBe(false)
  })

  test('auto-backup is disabled by default and backs up one or multiple Java instances with retention rotation', async () => {
    const defaultCfg = await backupService.getAutoBackupConfig()
    expect(defaultCfg.enabled).toBe(false)
    expect(defaultCfg.instancePaths).toEqual([])
    expect(defaultCfg.intervalMinutes).toBe(60)
    expect(defaultCfg.maxBackups).toBe(5)

    // Create two Java instances and one Bedrock instance
    const inst1 = join(gameDataDir, 'instances', 'AutoInst1')
    const inst2 = join(gameDataDir, 'instances', 'AutoInst2')
    const bedrockInst = join(gameDataDir, 'instances', 'BedrockAuto')
    await ensureDir(join(inst1, 'saves', 'WorldA'))
    await ensureDir(join(inst2, 'saves', 'WorldB'))
    await ensureDir(bedrockInst)

    await writeJson(join(inst1, 'instance.json'), {
      name: 'AutoInst1',
      runtime: { minecraft: '1.20.1' },
    })
    await writeFile(join(inst1, 'saves', 'WorldA', 'level.dat'), 'world-a-data')

    await writeJson(join(inst2, 'instance.json'), {
      name: 'AutoInst2',
      runtime: { minecraft: '1.20.4' },
    })
    await writeFile(join(inst2, 'saves', 'WorldB', 'level.dat'), 'world-b-data')

    await writeJson(join(bedrockInst, 'instance.json'), {
      name: 'BedrockAuto',
      edition: 'bedrock',
      runtime: { minecraft: '1.20.0' },
    })

    const autoDest = join(tempDir, 'auto-backups')
    const updatedCfg = await backupService.setAutoBackupConfig({
      enabled: false, // keep timer off during unit test, trigger manually via runAutoBackupNow
      destinationDir: autoDest,
      maxBackups: 2,
      instancePaths: [inst1, inst2, bedrockInst],
      includeSaves: true,
      includeConfigs: true,
      includeMods: false,
    })

    expect(updatedCfg.destinationDir).toBe(autoDest)
    expect(updatedCfg.maxBackups).toBe(2)

    // Run first auto-backup
    const firstPath = await backupService.runAutoBackupNow()
    expect(firstPath).toBeTruthy()

    const manifest = await backupService.loadBackupManifest(firstPath!)
    expect(manifest.includes.instances.map((i) => i.name).sort()).toEqual(['AutoInst1', 'AutoInst2'])

    // Wait a couple milliseconds so filenames/mtimes differ, then create 2 more to test rotation (maxBackups = 2)
    await new Promise((resolve) => setTimeout(resolve, 15))
    const secondPath = await backupService.runAutoBackupNow()
    expect(secondPath).toBeTruthy()

    await new Promise((resolve) => setTimeout(resolve, 15))
    const thirdPath = await backupService.runAutoBackupNow()
    expect(thirdPath).toBeTruthy()

    const list = await backupService.listAutoBackups()
    expect(list).toHaveLength(2)

    // Delete one auto-backup
    await backupService.deleteAutoBackup(list[0].filePath)

    const listAfterDelete = await backupService.listAutoBackups()
    expect(listAfterDelete).toHaveLength(1)
  })
})
