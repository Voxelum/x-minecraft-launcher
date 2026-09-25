import { InstanceSchema } from '@xmcl/instance'
import { InstanceState } from '@xmcl/runtime-api'
import { ensureDir, mkdtemp, pathExists, rm, writeFile } from 'fs-extra'
import { rm as cleanup } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MutexManager from '~/app/MutexManager'

vi.mock('~/app', () => ({
  Inject: () => () => {},
  LauncherAppKey: Symbol('LauncherAppKey'),
  kGameDataPath: Symbol('kGameDataPath'),
  PathResolver: class {},
}))
vi.mock('~/infra', () => ({
  ImageStorage: class {},
  Tasks: class {},
  kTasks: Symbol('kTasks'),
}))
vi.mock('fs-extra', async (importOriginal) => {
  const { default: actual } = await importOriginal<{ default: typeof import('fs-extra') }>()
  return { ...actual, default: actual, rm: vi.fn(actual.rm) }
})

const { InstanceService } = await import('./InstanceService')

describe('InstanceService deletion', () => {
  const roots: string[] = []
  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(roots.splice(0).map(path => cleanup(path, { recursive: true, force: true })))
  })

  async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'xmcl-delete-instance-'))
    roots.push(root)
    const path = join(root, 'instances', 'test')
    await ensureDir(path)
    await writeFile(join(path, 'instance.json'), '{}')
    const state = new InstanceState()
    state.instanceAdd({ ...InstanceSchema.parse({ name: 'Test' }), path })
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const app = {
      appDataPath: root,
      minecraftDataPath: root,
      getLogger: () => logger,
      controller: { broadcast: vi.fn() },
    } as any
    app.mutex = new MutexManager(app)
    const service = new InstanceService(
      app, { registerStatic: () => state } as any, {} as any,
      (...paths) => join(root, ...paths), {} as any, {} as any,
    )
    vi.spyOn(service, 'initialize').mockResolvedValue(undefined)
    return { path, state, service, logger }
  }

  it.each(['EBUSY', 'EACCES', 'EIO'])('propagates %s and preserves the instance for retry', async (code) => {
    const f = await fixture()
    const error = Object.assign(new Error('cannot remove files'), { code, errno: -1 })
    vi.mocked(rm).mockRejectedValueOnce(error)
    await expect(f.service.deleteInstance(f.path)).rejects.toBe(error)
    expect(error.name).toBe('InstanceDeleteError')
    expect(f.state.all[f.path]).toBeDefined()
    expect(await pathExists(f.path)).toBe(true)

    await f.service.deleteInstance(f.path)
    expect(f.state.all[f.path]).toBeUndefined()
    expect(await pathExists(f.path)).toBe(false)
  })

  it.each(['ENOENT', 'EPERM'])('preserves the existing tolerated %s behavior with a warning', async (code) => {
    const f = await fixture()
    vi.mocked(rm).mockRejectedValueOnce(Object.assign(new Error('remove failed'), { code, errno: -1 }))
    await f.service.deleteInstance(f.path)
    expect(f.state.all[f.path]).toBeUndefined()
    expect(f.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Fail to remove instance'))
  })

  it('waits for removal handlers before deleting files and state', async () => {
    const f = await fixture()
    const writer = Promise.withResolvers<void>()
    const entered = Promise.withResolvers<void>()
    f.service.registerRemoveHandler(f.path, () => {
      entered.resolve()
      return writer.promise
    })
    const deleting = f.service.deleteInstance(f.path)
    try {
      await entered.promise
      expect(await pathExists(f.path)).toBe(true)
      expect(f.state.all[f.path]).toBeDefined()
    } finally {
      writer.resolve()
      await deleting
    }
    expect(await pathExists(f.path)).toBe(false)
    expect(f.state.all[f.path]).toBeUndefined()
  })
})
