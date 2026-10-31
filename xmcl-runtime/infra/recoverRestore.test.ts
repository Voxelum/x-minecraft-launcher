import { describe, expect, test, vi } from 'vitest'
const recover = vi.hoisted(() => vi.fn())
vi.mock('~/backup/restoreTransaction', () => ({ RestoreTransaction: { recover } }))
import { recoverRestore } from './recoverRestore'
describe('startup restore recovery', () => {
  test('coalesces all initialization readers before reading app data', async () => {
    recover.mockResolvedValue(undefined)
    const app = { appDataPath: '/launcher-data' } as any
    const first = recoverRestore(app)
    expect(recoverRestore(app)).toBe(first)
    await first
    expect(recover).toHaveBeenCalledWith('/launcher-data/restore-transactions')
  })
  test('keeps recovery failure rejected for every reader, rather than loading fallback data', async () => {
    recover.mockRejectedValue(new Error('recovery evidence retained'))
    const app = { appDataPath: '/broken-data' } as any
    const first = recoverRestore(app)
    await expect(first).rejects.toThrow('evidence retained')
    expect(recoverRestore(app)).toBe(first)
    await expect(recoverRestore(app)).rejects.toThrow('evidence retained')
  })
})
