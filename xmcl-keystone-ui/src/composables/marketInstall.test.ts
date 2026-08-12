import type { InstanceFile } from '@xmcl/instance'
import { describe, expect, it, vi } from 'vitest'
import { installMarketFiles } from './marketInstall'

describe('installMarketFiles', () => {
  it('installs resolved files immediately', async () => {
    const installInstanceFiles = vi.fn().mockResolvedValue(undefined)
    const oldFiles: InstanceFile[] = [{ path: 'mods/old.jar', hashes: {} }]
    const files: InstanceFile[] = [{ path: 'mods/new.jar', hashes: { sha1: 'new' } }]

    await expect(installMarketFiles(installInstanceFiles, 'instance', oldFiles, files)).resolves.toEqual([
      'mods/new.jar',
    ])
    expect(installInstanceFiles).toHaveBeenCalledWith({
      path: 'instance',
      oldFiles,
      files,
    })
  })
})