import { EventEmitter } from 'events'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  readAllEntries: vi.fn(),
  stat: vi.fn(),
}))

vi.mock('@xmcl/unzip', () => ({
  open: mocks.open,
  readAllEntries: mocks.readAllEntries,
}))

vi.mock('fs-extra', () => ({
  stat: mocks.stat,
}))

import { ZipManager } from './zip_manager'

describe('ZipManager', () => {
  it('reuses an archive opened through a different path with the same inode', async () => {
    const zip = Object.assign(new EventEmitter(), {
      isOpen: true,
      close: vi.fn(),
    })
    mocks.stat.mockResolvedValue({ ino: 42 })
    mocks.open.mockResolvedValue(zip)
    mocks.readAllEntries.mockResolvedValue([])

    const manager = new ZipManager()
    const first = await manager.open('C:\\modpacks\\original.mrpack')
    const aliased = await manager.open('C:\\modpacks\\renamed.mrpack')

    expect(aliased).toBe(first)
    expect(mocks.open).toHaveBeenCalledTimes(1)
  })
})
