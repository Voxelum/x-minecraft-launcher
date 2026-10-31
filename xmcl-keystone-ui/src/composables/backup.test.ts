import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBackupSelection } from './backupSelection'
import { formatBackupError } from './backupError'
import type { BackupManifest } from '@xmcl/runtime-api'

const mocks = vi.hoisted(() => ({
  on: vi.fn(), removeListener: vi.fn(), notify: vi.fn(), loadBackupManifest: vi.fn(), restoreBackup: vi.fn(),
}))
vi.mock('./service', () => ({ useService: () => mocks }))
vi.mock('./notifier', () => ({ useNotifier: () => ({ notify: mocks.notify }) }))
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
import { useBackup } from './backup'

const archive: BackupManifest = {
  version: 1, createdAt: 1, appVersion: 'test',
  includes: { settings: true, collections: false, themes: false, instances: [] },
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

beforeEach(() => vi.clearAllMocks())

describe('backup archive selection', () => {
  it('clears archive, path and instance selection immediately and rejects stale completion', async () => {
    const selection = useBackupSelection()
    selection.accept(selection.token(), 'old.zip', archive)
    selection.instances.value = ['old-instance']
    const pending = deferred<BackupManifest>()
    const oldToken = selection.token()
    const loading = pending.promise.then(manifest => selection.accept(oldToken, 'old.zip', manifest))
    selection.reset()
    expect(selection.path.value).toBe('')
    expect(selection.manifest.value).toBeNull()
    expect(selection.instances.value).toEqual([])
    selection.accept(selection.token(), 'new.zip', archive)
    pending.resolve(archive)
    expect(await loading).toBe(false)
    expect(selection.path.value).toBe('new.zip')
  })

  it('a broken replacement archive cannot leave the previous selection restorable', async () => {
    const selection = useBackupSelection()
    selection.accept(selection.token(), 'old.zip', archive)
    selection.reset()
    const token = selection.token()
    const read = Promise.reject(new Error('corrupt zip'))
    await expect(read.then(value => selection.accept(token, 'bad.zip', value))).rejects.toThrow('corrupt zip')
    expect(selection.path.value).toBe('')
    expect(selection.manifest.value).toBeNull()
    expect(selection.instances.value).toEqual([])
  })

  it('reset invalidates a native picker result even without another archive read', () => {
    const selection = useBackupSelection()
    const pickerToken = selection.token()
    selection.reset()
    expect(selection.isCurrent(pickerToken)).toBe(false)
    expect(selection.accept(pickerToken, 'closed-dialog.zip', archive)).toBe(false)
  })
})

describe('backup lifecycle', () => {
  it('removes all exact listener references when Settings scope is disposed', () => {
    const scope = effectScope()
    scope.run(() => useBackup())
    expect(mocks.on).toHaveBeenCalledTimes(3)
    scope.stop()
    expect(mocks.removeListener.mock.calls).toEqual(mocks.on.mock.calls)
  })

  it('a stale manifest request cannot clear the current request loading state', async () => {
    const first = deferred<BackupManifest>()
    const second = deferred<BackupManifest>()
    mocks.loadBackupManifest.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const scope = effectScope()
    const backup = scope.run(() => useBackup())!
    const a = backup.loadBackupManifest('a')
    const b = backup.loadBackupManifest('b')
    first.resolve(archive)
    await a
    expect(backup.isLoadingManifest.value).toBe(true)
    second.reject(new Error('broken archive'))
    await expect(b).rejects.toThrow('broken archive')
    expect(backup.isLoadingManifest.value).toBe(false)
    scope.stop()
  })

  it('rejects duplicate restore submission while the first call is pending', async () => {
    const pending = deferred<never>()
    mocks.restoreBackup.mockReturnValueOnce(pending.promise)
    const scope = effectScope()
    const backup = scope.run(() => useBackup())!
    const first = backup.restoreBackup({ backupPath: 'one.zip' })
    await expect(backup.restoreBackup({ backupPath: 'two.zip' })).rejects.toThrow()
    expect(mocks.restoreBackup).toHaveBeenCalledTimes(1)
    pending.reject(new Error('failed'))
    await expect(first).rejects.toThrow('failed')
    scope.stop()
  })

  it('restore failure never returns success and retains recovery location in notification', async () => {
    const error = Object.assign(new Error('rollback failed'), { recoveryPath: '/recovery/journal' })
    mocks.restoreBackup.mockRejectedValueOnce(error)
    const scope = effectScope()
    const backup = scope.run(() => useBackup())!
    await expect(backup.restoreBackup({ backupPath: 'bad.zip' })).rejects.toBe(error)
    expect(backup.isRestoring.value).toBe(false)
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ body: 'rollback failed\n/recovery/journal' }))
    scope.stop()
  })
})

describe('backup error display', () => {
  it('supports direct and IPC serialized recovery paths without rendering arbitrary objects', () => {
    expect(formatBackupError({ message: 'failed', exception: { recoveryPath: '/safe/journal' } }))
      .toEqual({ message: 'failed', recoveryPath: '/safe/journal' })
    expect(formatBackupError({ message: 'failed', recoveryPath: {} }).recoveryPath).toBe('')
    expect(formatBackupError({ message: '' }).message).toBeTruthy()
    expect(formatBackupError({ message: '', exception: { message: 'Cancelled' } }).message).toBe('Cancelled')
  })
})
