import {
  CURRENT_COLLECTION_SCHEMA_VERSION,
  LocalCollectionState,
  Settings,
} from '@xmcl/runtime-api'
import { ensureDir, mkdtemp, readFile, readJson, rm, writeFile, writeJson } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { open, readAllEntries } from '@xmcl/unzip'

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
    tempDir = await mkdtemp(join(tmpdir(), 'xmcl-backup-test-'))
    appDataDir = join(tempDir, 'appData')
    gameDataDir = join(tempDir, 'gameData')
    await ensureDir(appDataDir)
    await ensureDir(gameDataDir)

    mockSettingsState = new Settings()
    mockApp = {
      appDataPath: appDataDir,
      version: '0.45.0',
      registry: {
        get: vi.fn().mockImplementation((key) => {
          return Promise.resolve(mockSettingsState)
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
        collectionUpsert: vi.fn(),
      },
    }

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
    expect(mockCollectionService.state.collectionUpsert).toHaveBeenCalled()
    expect(mockInstanceService.loadInstance).toHaveBeenCalled()
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
})
