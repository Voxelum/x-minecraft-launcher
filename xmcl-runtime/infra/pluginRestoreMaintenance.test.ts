import { CollectionsFileSchema, CURRENT_COLLECTION_SCHEMA_VERSION, InstanceState, LocalCollectionState, Settings, SettingSchema } from '@xmcl/runtime-api'
import { describe, expect, test, vi } from 'vitest'
import { ObjectFactory } from '../app/objectRegistry'
import { kRestoreMaintenance } from '../backup/restoreMaintenance'
import { getRestoreGate } from './restoreGate'
import { kSettings } from '../settings/settings'

vi.mock('~/infra/recoverRestore', () => ({ recoverRestore: vi.fn(async () => {}) }))
vi.mock('~/collection/CollectionService', () => ({ CollectionService: class {} }))
vi.mock('~/instance/InstanceService', () => ({ InstanceService: class {} }))
vi.mock('~/launch/LaunchService', () => ({ LaunchService: class {} }))
vi.mock('~/theme/ThemeService', () => ({ ThemeService: class {} }))
const { CollectionService } = await import('~/collection/CollectionService')
const { InstanceService } = await import('~/instance/InstanceService')
const { LaunchService } = await import('~/launch/LaunchService')
const { ThemeService } = await import('~/theme/ThemeService')
const { pluginRestoreMaintenance } = await import('./pluginRestoreMaintenance')

function fixture() {
  const app = { appDataPath: '/unused', registry: new ObjectFactory() } as any
  const gate = getRestoreGate(app)
  const settings = new Settings()
  const state = new LocalCollectionState()
  const instances = new InstanceState()
  gate.guardState(settings)
  gate.guardState(state)
  gate.guardState(instances)
  const publishInstances = vi.fn()
  const prepare = vi.fn(() => Buffer.from('{}'))
  app.registry.register(kSettings, settings)
  app.registry.register(CollectionService, { state, initialize: async () => {}, publishRestore: (data: any) => state.collectionsState(data.collections) } as any)
  app.registry.register(InstanceService, { state: instances, initialize: async () => {}, publishRestoreInstances: publishInstances, prepareRestoreInstances: prepare } as any)
  app.registry.register(LaunchService, { getProcesses: () => [] } as any)
  app.registry.register(ThemeService, { initialize: async () => {} } as any)
  pluginRestoreMaintenance(app, {} as any)
  return { app, gate, settings, state, instances, publishInstances, prepare }
}

describe('restore maintenance lease', () => {
  test('prepares without publication, publishes without save, rolls back complete snapshots', async () => {
    const f = fixture()
    const original = SettingSchema.parse(f.settings)
    f.state.collectionCorrupted(true)
    const save = vi.fn(async () => {})
    const writer = f.gate.writer(save)
    // Same subscription behavior as settings/collection services.
    const config = f.settings.config.bind(f.settings)
    f.settings.config = (data) => { config(data); writer.schedule() }
    const lease = await (await f.app.registry.get(kRestoreMaintenance)).enter()
    await lease.prepareInstances([])
    expect(f.prepare).toHaveBeenCalledWith([])
    expect(f.publishInstances).not.toHaveBeenCalled()
    const incoming = CollectionsFileSchema.parse({ schemaVersion: CURRENT_COLLECTION_SCHEMA_VERSION, collections: [] })
    await lease.publish({ settings: { ...original, locale: 'zh-CN' }, collections: incoming, instances: [] })
    expect(f.settings.locale).toBe('zh-CN')
    expect(() => f.settings.config(original)).toThrow('maintenance')
    await lease.undoPublish()
    expect(SettingSchema.parse(f.settings)).toEqual(original)
    expect(f.state.corrupted).toBe(true)
    await writer.flush()
    expect(save).not.toHaveBeenCalled()
    await lease.release(false)
    f.settings.config(original)
    await writer.flush()
    expect(save).toHaveBeenCalledOnce()
    await expect(lease.publish({ instances: [] })).rejects.toThrow('released')
  })
  test('partial publication can undo and recovery-required release blocks subsequent changes', async () => {
    const f = fixture()
    const original = SettingSchema.parse(f.settings)
    f.publishInstances.mockImplementation(() => { throw new Error('publication failed') })
    const lease = await (await f.app.registry.get(kRestoreMaintenance)).enter()
    await expect(lease.publish({ settings: { ...original, locale: 'de' }, instances: [] })).rejects.toThrow('publication failed')
    await lease.undoPublish()
    expect(SettingSchema.parse(f.settings)).toEqual(original)
    await lease.release(true)
    await expect(lease.release(false)).rejects.toThrow('released')
    expect(() => f.settings.config(original)).toThrow('maintenance')
  })
})
