import { describe, expect, it } from 'vitest'
import { ElectronUpdater } from './updater'

const staleRelease = { name: 'XMCL', date: '', body: '', files: [], newUpdate: true, operation: 'autoupdater' }

describe('Vardrynn update boundary', () => {
  it('rejects discovery, download, and installation of cached upstream metadata', async () => {
    const updater = new ElectronUpdater()
    expect(updater.capability).toEqual({ automatic: false, reason: 'not-configured' })
    await expect(updater.checkUpdateTask()).rejects.toThrow('unavailable')
    await expect(updater.downloadUpdate(staleRelease)).rejects.toThrow('unavailable')
    await expect(updater.installUpdateAndQuit(staleRelease)).rejects.toThrow('unavailable')
  })
})
