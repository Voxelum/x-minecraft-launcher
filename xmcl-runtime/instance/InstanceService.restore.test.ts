import { InstanceState } from '@xmcl/runtime-api'
import { EventEmitter } from 'events'
import { InstanceSchema } from '@xmcl/instance'
import { ensureDir, mkdtemp, pathExists, readFile, readJson, realpath, rm, writeJson } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, expect, test, vi } from 'vitest'
import { ServiceStateManager } from '~/service'
import { getRestoreGate } from '~/infra/restoreGate'

vi.mock('~/app', () => ({ Inject: () => () => {}, LauncherAppKey: Symbol('app'), kGameDataPath: Symbol('game') }))
vi.mock('~/infra', () => ({ ImageStorage: class {}, Tasks: class {}, kTasks: Symbol('tasks') }))
const { InstanceService } = await import('./InstanceService')
const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

async function fixture() {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'xmcl-restore-instance-')))
  roots.push(root)
  const original = join(root, 'instances', 'original')
  await ensureDir(original)
  await writeJson(join(original, 'instance.json'), InstanceSchema.parse({ name: 'original' }))
  await writeJson(join(root, 'instances.json'), {
    selectedInstance: 'original', instances: ['original'], groups: [{ id: 'group', name: 'Group', color: '', instances: ['original'] }],
  })
  const disposers: Array<() => Promise<void> | void> = []
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
  const app = {
    appDataPath: root, minecraftDataPath: root,
    getLogger: () => logger,
    registryDisposer: (fn: () => Promise<void> | void) => disposers.push(fn),
    controller: { handle: vi.fn(), broadcast: vi.fn() },
  } as any
  const manager = new ServiceStateManager(app)
  const service = new InstanceService(app, manager, { getLatestRelease: () => '1.21' } as any,
    (...paths) => join(root, ...paths), {} as any, {} as any)
  await service.initialize()
  return { root, original, app, service, manager, dispose: async () => { for (const fn of disposers.reverse()) await fn() } }
}

test('prepares relative launcher metadata without loading, renaming or writing prospective instances', async () => {
  const f = await fixture()
  const incoming = [{ path: join(f.root, 'instances', 'restore-path'), data: InstanceSchema.parse({ name: 'Different display name' }) }]
  const before = await readFile(join(f.root, 'instances.json'), 'utf8')
  const data = JSON.parse(f.service.prepareRestoreInstances(incoming).toString())
  expect(data.selectedInstance).toBe('original')
  expect(data.groups[0].instances).toEqual(['original'])
  expect(data.instances).toEqual(['original', 'restore-path'])
  const sibling = join(f.root, 'instances-not-managed', 'external')
  const external = JSON.parse(f.service.prepareRestoreInstances([{ path: sibling, data: incoming[0].data }]).toString())
  expect(external.instances).toEqual(['original', sibling])
  expect(f.service.state.instances).toHaveLength(1)
  expect(await pathExists(incoming[0].path)).toBe(false)
  expect(await readFile(join(f.root, 'instances.json'), 'utf8')).toBe(before)
  await f.dispose()
})

test('drains real async instance subscriptions before publication; publication and undo do not persist or rename', async () => {
  const f = await fixture()
  const gate = getRestoreGate(f.app)
  f.service.state.instanceEdit({ path: f.original, description: 'last pre-maintenance edit' })
  await gate.enter(() => {})
  expect((await readJson(join(f.original, 'instance.json'))).description).toBe('last pre-maintenance edit')
  const beforeMetadata = await readFile(join(f.root, 'instances.json'), 'utf8')
  const incoming = [{ path: join(f.root, 'instances', 'restore-path'), data: InstanceSchema.parse({ name: 'Different display name' }) }]
  await ensureDir(incoming[0].path)
  await writeJson(join(incoming[0].path, 'instance.json'), incoming[0].data)
  const incomingJson = await readFile(join(incoming[0].path, 'instance.json'), 'utf8')
  expect(() => f.service.state.instanceEdit({ path: f.original, description: 'racing edit' })).toThrow('maintenance')
  const onAdd = vi.fn()
  const onRemove = vi.fn()
  f.service.state.subscribe('instanceAdd', onAdd)
  f.service.state.subscribe('instanceRemove', onRemove)
  const beforeInstances = JSON.parse(JSON.stringify(f.service.state.instances))
  const client = Object.assign(new EventEmitter(), { send: vi.fn() })
  f.manager.serializeAndTrack(client as any, f.service.state)
  gate.publish(() => f.service.publishRestoreInstances(incoming))
  expect(f.service.state.all[incoming[0].path].name).toBe('Different display name')
  expect(await pathExists(join(f.root, 'instances', 'Different display name'))).toBe(false)
  gate.publish(() => {
    f.service.state.instanceRestore(beforeInstances)
    f.service.state.instanceGroupsSet(f.service.state.groups)
  })
  expect(onAdd).not.toHaveBeenCalled()
  expect(onRemove).not.toHaveBeenCalled()
  const commits = client.send.mock.calls.filter(call => call[2] === 'instanceRestore')
  expect(commits).toHaveLength(2)
  const renderer = new InstanceState()
  renderer.instanceRestore(commits[0][3])
  expect(renderer.all[incoming[0].path].name).toBe('Different display name')
  renderer.instanceRestore(commits[1][3])
  expect(renderer.instances).toEqual(beforeInstances)
  expect(renderer.all[incoming[0].path]).toBeUndefined()
  gate.release(false)
  await f.dispose()
  expect(await readFile(join(f.root, 'instances.json'), 'utf8')).toBe(beforeMetadata)
  expect(await readFile(join(incoming[0].path, 'instance.json'), 'utf8')).toBe(incomingJson)
})
