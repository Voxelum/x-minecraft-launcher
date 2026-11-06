import { describe, expect, test, vi } from 'vitest'
const recover = vi.hoisted(() => vi.fn())
const recoverImport = vi.hoisted(() => vi.fn())
vi.mock('~/backup/restoreTransaction', () => ({ RestoreTransaction: { recover } }))
vi.mock('~/setup/xmclImport', () => ({ recoverXmclImport: recoverImport }))
import { recoverRestore } from './recoverRestore'
const host = (locked: boolean) => ({ requestSingleInstanceLock: () => locked })
describe('startup restore recovery', () => {
  test('applies a queued import only while holding the single-instance lock', async () => {
    recover.mockResolvedValue(undefined)
    recoverImport.mockReset().mockResolvedValue(undefined)
    await recoverRestore({ appDataPath: '/second', host: host(false) } as any)
    expect(recoverImport).not.toHaveBeenCalled()
    await recoverRestore({ appDataPath: '/primary', host: host(true) } as any)
    expect(recoverImport).toHaveBeenCalledWith('/primary')
  })
  test('logs a failed import recovery and still opens the launcher', async () => {
    recover.mockResolvedValue(undefined)
    recoverImport.mockReset().mockRejectedValue(new Error('retry on next start'))
    const warn = vi.fn()
    await recoverRestore({ appDataPath: '/primary', host: host(true), getLogger: () => ({ warn }) } as any)
    expect(warn).toHaveBeenCalled()
  })
  test('coalesces all initialization readers before reading app data', async () => {
    recover.mockResolvedValue(undefined)
    const app = { appDataPath: '/launcher-data', host: host(false) } as any
    const first = recoverRestore(app)
    expect(recoverRestore(app)).toBe(first)
    await first
    expect(recover).toHaveBeenCalledWith('/launcher-data/restore-transactions')
  })
  test('keeps recovery failure rejected for every reader, rather than loading fallback data', async () => {
    recover.mockRejectedValue(new Error('recovery evidence retained'))
    const app = { appDataPath: '/broken-data', host: host(false) } as any
    const first = recoverRestore(app)
    await expect(first).rejects.toThrow('evidence retained')
    expect(recoverRestore(app)).toBe(first)
    await expect(recoverRestore(app)).rejects.toThrow('evidence retained')
  })
})
