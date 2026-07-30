import { CURRENT_COLLECTION_SCHEMA_VERSION, LocalCollectionState } from '@xmcl/runtime-api'
import { mkdtemp, readFile, rm, writeFile } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

// The `~/` alias points at xmcl-runtime and is not configured for Vitest.
// Mock the two framework modules the service depends on with the minimal
// surface it actually uses (matching pluginSettings.test.ts style).
vi.mock('~/app', () => ({
  LauncherAppKey: Symbol('LauncherAppKey'),
  Inject: () => () => { },
  LauncherApp: class { },
}))

vi.mock('~/service', () => {
  const { join: joinPath } = require('path')
  return {
    ExposeServiceKey: () => () => { },
    ServiceStateManager: class { },
    StatefulService: class {
      app: any
      state: any
      private _initializer?: () => Promise<void>
      private _initialized = false
      constructor(app: any, createState: () => any, initializer?: () => Promise<void>) {
        this.app = app
        this.state = createState()
        this._initializer = initializer
      }

      async initialize() {
        if (!this._initialized) {
          this._initialized = true
          if (this._initializer) await this._initializer()
        }
      }

      getAppDataPath = (...args: string[]) => joinPath(this.app.appDataPath, ...args)
      log = () => { }
      warn = () => { }
      error = () => { }
    },
  }
})

const { CollectionService } = await import('./CollectionService')
type CollectionService = InstanceType<typeof CollectionService>

function createMockApp(appDataPath: string) {
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
  return {
    appDataPath,
    minecraftDataPath: appDataPath,
    getLogger: () => logger,
    controller: { broadcast: vi.fn() },
    registry: { get: vi.fn(), register: vi.fn() },
  } as any
}

function createMockStore() {
  return {
    // Return the plain state so mutations run their real implementation.
    registerStatic: (state: LocalCollectionState) => state,
  } as any
}

function newService(appDataPath: string) {
  return new CollectionService(createMockApp(appDataPath), createMockStore())
}

async function flush(service: CollectionService) {
  // The saver is a debounced function; flush pending writes.
  await (service as any).save.flush()
}

describe('CollectionService', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'xmcl-collection-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true }).catch(() => { })
  })

  test('starts empty when no file exists', async () => {
    const service = newService(dir)
    const state = await service.getLocalCollections()
    expect(state.collections).toHaveLength(0)
  })

  test('creates, updates and deletes a collection', async () => {
    const service = newService(dir)
    await service.getLocalCollections()

    const created = await service.createCollection({ name: 'My pack', description: 'hello' })
    expect(created.id).toBeTruthy()
    expect(created.name).toBe('My pack')

    await service.updateCollection(created.id, { name: 'Renamed' })
    const state = await service.getLocalCollections()
    expect(state.collections.find((c) => c.id === created.id)?.name).toBe('Renamed')

    await service.deleteCollection(created.id)
    expect((await service.getLocalCollections()).collections.find((c) => c.id === created.id)).toBeUndefined()
  })

  test('adds and removes provider-qualified entries and preserves provider', async () => {
    const service = newService(dir)
    await service.getLocalCollections()
    const created = await service.createCollection({ name: 'c' })

    await service.addEntry({ collectionId: created.id, contentType: 'mods', entry: { provider: 'modrinth', projectId: 'AABBCC' } })
    await service.addEntry({ collectionId: created.id, contentType: 'mods', entry: { provider: 'curseforge', projectId: 'AABBCC' } })
    await service.addEntry({ collectionId: created.id, contentType: 'resourcepacks', entry: { provider: 'modrinth', projectId: 'RP' } })

    const state = await service.getLocalCollections()
    const c = state.collections.find((x) => x.id === created.id)!
    // Same projectId but different provider must remain distinct entries.
    expect(c.mods).toHaveLength(2)
    expect(c.mods).toContainEqual({ provider: 'modrinth', projectId: 'AABBCC' })
    expect(c.mods).toContainEqual({ provider: 'curseforge', projectId: 'AABBCC' })
    expect(c.resourcepacks).toHaveLength(1)

    await service.removeEntry({ collectionId: created.id, contentType: 'mods', entry: { provider: 'modrinth', projectId: 'AABBCC' } })
    const after = (await service.getLocalCollections()).collections.find((x) => x.id === created.id)!
    expect(after.mods).toHaveLength(1)
    expect(after.mods).toContainEqual({ provider: 'curseforge', projectId: 'AABBCC' })
  })

  test('deduplicates identical provider + projectId entries', async () => {
    const service = newService(dir)
    await service.getLocalCollections()
    const created = await service.createCollection({ name: 'c' })
    await service.addEntry({ collectionId: created.id, contentType: 'mods', entry: { provider: 'modrinth', projectId: 'X' } })
    await service.addEntry({ collectionId: created.id, contentType: 'mods', entry: { provider: 'modrinth', projectId: 'X' } })
    const c = (await service.getLocalCollections()).collections.find((x) => x.id === created.id)!
    expect(c.mods).toHaveLength(1)
  })

  test('persists across a reload and never writes resolved file/version ids', async () => {
    const service = newService(dir)
    await service.getLocalCollections()
    const created = await service.createCollection({ name: 'Durable' })
    await service.addEntry({ collectionId: created.id, contentType: 'shaderpacks', entry: { provider: 'curseforge', projectId: '999' } })
    await flush(service)

    const filePath = join(dir, 'collections.json')
    const onDisk = JSON.parse(await readFile(filePath, 'utf-8'))
    expect(onDisk.schemaVersion).toBe(CURRENT_COLLECTION_SCHEMA_VERSION)
    // Only provider-qualified project ids are persisted.
    expect(JSON.stringify(onDisk)).not.toMatch(/versionId|fileId|downloadUrl/i)
    expect(onDisk.collections.find((c: any) => c.id === created.id).shaderpacks).toEqual([
      { provider: 'curseforge', projectId: '999' },
    ])

    // A fresh service instance loads the same entries.
    const reloaded = newService(dir)
    const state = await reloaded.getLocalCollections()
    const c = state.collections.find((x) => x.id === created.id)
    expect(c?.shaderpacks).toEqual([{ provider: 'curseforge', projectId: '999' }])
  })

  test('recovers from corrupt data without leaving a half-written file', async () => {
    const filePath = join(dir, 'collections.json')
    await writeFile(filePath, '{ this is not valid json ')

    const service = newService(dir)
    const state = await service.getLocalCollections()
    expect(state.corrupted).toBe(true)
    // Recovered to a valid empty state.
    expect(state.collections).toHaveLength(0)
    // The bad file was moved aside for the user to recover.
    const backup = await readFile(`${filePath}.corrupted`, 'utf-8')
    expect(backup).toContain('not valid json')
  })

  test('rejects a file written by a newer schema version', async () => {
    const filePath = join(dir, 'collections.json')
    await writeFile(filePath, JSON.stringify({ schemaVersion: CURRENT_COLLECTION_SCHEMA_VERSION + 1, collections: [] }))

    const service = newService(dir)
    const state = await service.getLocalCollections()
    expect(state.corrupted).toBe(true)
    expect(state.collections).toHaveLength(0)
  })
})
