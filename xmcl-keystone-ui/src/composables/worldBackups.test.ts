import { describe, expect, test, vi } from 'vitest'
import { mergeWorldBackups, useWorldBackups, WorldBackupClientError } from './worldBackups'
import type { PreparedClientWorldBackup, WorldBackupResource, WorldBackupService } from '@xmcl/runtime-api'

const source = { instancePath: 'C:\\instances\\one', saveName: 'World' }
const object = { format: 'linear' as const, formatVersion: 1 as const, sizeBytes: 12, sha256: 'a'.repeat(64) }
const prepared: PreparedClientWorldBackup = { snapshotId: 'snapshot', sourceId: 'client:world', worldId: 'world', object }
const creating: WorldBackupResource = {
  backupId: 'backup', sourceType: 'client_world', sourceId: 'client:world', worldId: 'world',
  format: 'linear', formatVersion: 1, status: 'creating', statusVersion: 1, updatedAt: '2026-01-01T00:00:00.000Z',
}

function mockService(overrides: Partial<WorldBackupService> = {}) {
  return {
    listClientWorldBackups: vi.fn().mockResolvedValue([]),
    getClientWorldBackupStorageUsage: vi.fn().mockResolvedValue({
      policy: { freeBytes: 1_073_741_824, policyVersion: 1 },
      usedBytes: 1,
      overageBytes: 0,
      lastSettledAt: '2026-07-22T10:00:00.000Z',
      settlementIntervalSeconds: 3_600,
      countedObjects: [],
    }),
    prepareClientWorldBackup: vi.fn().mockResolvedValue(prepared),
    createWorldBackup: vi.fn().mockResolvedValue(creating),
    requestWorldBackupUpload: vi.fn().mockResolvedValue({ backupId: 'backup', url: 'https://upload.invalid', expiresAt: '2026-01-01T01:00:00Z', contentLength: 12, sha256: object.sha256, requiredHeaders: {} }),
    uploadPreparedWorldBackup: vi.fn().mockResolvedValue(undefined),
    completeWorldBackupUpload: vi.fn().mockResolvedValue({ ...creating, status: 'ready', statusVersion: 2 }),
    restoreClientWorldBackup: vi.fn().mockResolvedValue({ taskId: 'restore', requestId: 'request', status: 'queued' }),
    ...overrides,
  } as unknown as WorldBackupService
}

describe('world backup client proposal', () => {
  test('deduplicates duplicate events and ignores an out-of-order status', () => {
    const merged = mergeWorldBackups([
      { ...creating, status: 'ready', statusVersion: 2, updatedAt: '2026-01-02T00:00:00.000Z' },
      creating,
      { ...creating, backupId: 'other' },
    ])
    expect(merged).toHaveLength(2)
    expect(merged.find(backup => backup.backupId === 'backup')?.status).toBe('ready')
  })

  test('keeps a newer refresh when an older list request resolves out of order', async () => {
    let firstResolve!: (backups: WorldBackupResource[]) => void
    const first = new Promise<WorldBackupResource[]>((resolve) => { firstResolve = resolve })
    const service = mockService({ listClientWorldBackups: vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce([{ ...creating, status: 'ready', statusVersion: 2 }]) })
    const backups = useWorldBackups(service)
    const stale = backups.refresh(source)
    const current = backups.refresh(source)
    await current
    firstResolve([creating])
    await stale
    expect(backups.backups.value[0].status).toBe('ready')
  })

  test('reuses idempotency keys when an upload is retried', async () => {
    const service = mockService({ uploadPreparedWorldBackup: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined) })
    const backups = useWorldBackups(service)
    await backups.prepare(source, 'linear')
    await expect(backups.upload()).rejects.toThrow('offline')
    await backups.upload()

    const calls = vi.mocked(service.createWorldBackup).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[0][0].idempotencyKey).toBe(calls[1][0].idempotencyKey)
    expect(vi.mocked(service.completeWorldBackupUpload)).toHaveBeenCalledTimes(1)
  })

  test('does not create an overage upload when the balance fixture blocks it', async () => {
    const service = mockService()
    const backups = useWorldBackups(service)
    backups.storage.value = {
      policy: { freeBytes: 1_073_741_824, policyVersion: 1 },
      usedBytes: 1_073_741_825,
      overageBytes: 1,
      lastSettledAt: '2026-07-22T10:00:00.000Z',
      settlementIntervalSeconds: 3_600,
      countedObjects: [],
      uploadBlockedReason: 'insufficient_balance',
    }
    await backups.prepare(source, 'linear')
    await expect(backups.upload()).rejects.toMatchObject({ code: 'insufficient_balance' } satisfies Partial<WorldBackupClientError>)
    expect(service.createWorldBackup).not.toHaveBeenCalled()
  })

  test('does not upload when a duplicate create response has a conflicting status', async () => {
    const service = mockService({ createWorldBackup: vi.fn().mockResolvedValue({ ...creating, status: 'deleted', statusVersion: 2 }) })
    const backups = useWorldBackups(service)
    await backups.prepare(source, 'linear')
    await expect(backups.upload()).rejects.toMatchObject({ code: 'status_conflict' } satisfies Partial<WorldBackupClientError>)
    expect(service.requestWorldBackupUpload).not.toHaveBeenCalled()
  })
})
