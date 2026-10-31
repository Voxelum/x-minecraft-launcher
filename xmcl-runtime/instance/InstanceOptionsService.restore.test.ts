import { mkdtemp, pathExists, readFile, rm } from 'fs-extra'
import { tmpdir } from 'os'
import { join } from 'path'
import { expect, test, vi } from 'vitest'
import { getRestoreGate } from '~/infra/restoreGate'
vi.mock('~/app', () => ({ Inject: () => () => {}, LauncherAppKey: Symbol('app'), kGameDataPath: Symbol('game') }))
const { InstanceOptionsService } = await import('./InstanceOptionsService')

test('maintenance blocks explicit config writes and implicit options.txt initialization from a read/watch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-restore-options-'))
  try {
    const app = { getLogger: () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }), host: { getLocale: () => 'en-US' } } as any
    const service = new InstanceOptionsService(app, (...paths) => join(root, ...paths))
    const gate = getRestoreGate(app)
    await gate.enter(() => {})
    await expect(service.setInstanceConfig(root, 'test.txt', 'racing config')).rejects.toThrow('maintenance')
    await expect(service.getGameOptions(root)).rejects.toThrow('maintenance')
    expect(await pathExists(join(root, 'options.txt'))).toBe(false)
    expect(await pathExists(join(root, 'config', 'test.txt'))).toBe(false)
    gate.release(false)
    await service.getGameOptions(root)
    expect(await readFile(join(root, 'options.txt'), 'utf8')).toContain('lang:en_US')
  } finally { await rm(root, { recursive: true, force: true }) }
})
