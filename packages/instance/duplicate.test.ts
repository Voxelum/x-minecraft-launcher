import { describe, expect, test, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { duplicateInstance } from './duplicate'

vi.mock('./files_discovery', () => ({
  getInstanceFiles: vi.fn(),
}))

import { getInstanceFiles } from './files_discovery'

describe('duplicateInstance', () => {
  test('tolerates ENOENT on stale manifest entries without per-file unhandledRejection', async () => {
    const root = mkdtempSync(join(tmpdir(), 'xmcl-dup-'))
    const src = join(root, 'src')
    const dest = join(root, 'dest')
    mkdirSync(src, { recursive: true })
    mkdirSync(dest, { recursive: true })
    // Real file present + several stale manifest entries
    writeFileSync(join(src, 'real.txt'), 'hello')

    ;(getInstanceFiles as any).mockResolvedValue([
      [{ path: 'real.txt', size: 5, hashes: {} }, {}],
      [{ path: 'stale-a.json', size: 0, hashes: {} }, {}],
      [{ path: 'stale-b.png', size: 0, hashes: {} }, {}],
      [{ path: 'stale-c.cfg', size: 0, hashes: {} }, {}],
    ])

    const unhandled = vi.fn()
    process.on('unhandledRejection', unhandled)
    try {
      await duplicateInstance({ instancePath: src, newPath: dest })
      // Allow microtasks to drain
      await new Promise((r) => setImmediate(r))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off('unhandledRejection', unhandled)
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('throws a typed InstanceDuplicatePartialError when non-ENOENT failures occur', async () => {
    const root = mkdtempSync(join(tmpdir(), 'xmcl-dup-fail-'))
    const src = join(root, 'src')
    // Intentionally do NOT create dest — copyFile will fail with ENOENT
    // on its parent. We then turn that into a non-ENOENT condition by
    // pointing dest at a file path (ensureDir will fail with ENOTDIR).
    mkdirSync(src, { recursive: true })
    writeFileSync(join(src, 'real.txt'), 'hello')
    const destFilePath = join(root, 'dest-as-file')
    writeFileSync(destFilePath, 'oops')

    ;(getInstanceFiles as any).mockResolvedValue([
      [{ path: 'real.txt', size: 5, hashes: {} }, {}],
    ])

    await expect(duplicateInstance({ instancePath: src, newPath: destFilePath }))
      .rejects.toThrow()
    rmSync(root, { recursive: true, force: true })
  })
})
