import { describe, it, expect } from 'vitest'
import { computeFileUpdates } from './files_delta'
import type { InstanceFile } from './files'

/**
 * Build an in-memory FileSystem implementation for tests.
 *
 * Each entry maps a relative path within the instance to its on-disk metadata
 * and content hashes.
 */
function createFs(
  map: Record<string, { size: number; mtime: number; sha1?: string; crc32?: number }>,
  instancePath: string,
) {
  const norm = (path: string) => {
    const fwd = path.replace(/\\/g, '/')
    const inst = instancePath.replace(/\\/g, '/')
    if (fwd.startsWith(inst)) {
      return fwd.substring(inst.length).replace(/^\//, '')
    }
    return fwd
  }
  return {
    async getFile(path: string) {
      const v = map[norm(path)]
      if (!v) return undefined
      return { size: v.size, mtime: v.mtime }
    },
    async getSha1(_instancePath: string, file: { size: number; mtime: number }) {
      // Find by mtime+size (good enough for tests since each file is unique)
      const entry = Object.values(map).find(
        (v) => v.size === file.size && v.mtime === file.mtime,
      )
      return entry?.sha1 ?? ''
    },
    async getCrc32(_instancePath: string, file: { size: number; mtime: number }) {
      const entry = Object.values(map).find(
        (v) => v.size === file.size && v.mtime === file.mtime,
      )
      return entry?.crc32 ?? 0
    },
  }
}

const file = (path: string, sha1: string, size = 100): InstanceFile => ({
  path,
  hashes: { sha1 },
  size,
})

const INSTANCE = '/inst'

describe('computeFileUpdates', () => {
  it('marks a missing file as add', async () => {
    const fs = createFs({}, INSTANCE)
    const updates = await computeFileUpdates(
      INSTANCE,
      [],
      [file('mods/a.jar', 'AAA')],
      undefined,
      fs,
    )
    expect(updates).toEqual([{ file: file('mods/a.jar', 'AAA'), operation: 'add' }])
  })

  it('marks a file present and matching as keep', async () => {
    const fs = createFs(
      { 'mods/a.jar': { size: 100, mtime: 1000, sha1: 'AAA' } },
      INSTANCE,
    )
    const updates = await computeFileUpdates(
      INSTANCE,
      [file('mods/a.jar', 'AAA')],
      [file('mods/a.jar', 'AAA')],
      2000, // installed at t=2000, file mtime=1000 (unchanged)
      fs,
    )
    expect(updates[0].operation).toBe('keep')
  })

  it('marks a removed file (in old, not in new) as remove', async () => {
    const fs = createFs(
      { 'mods/a.jar': { size: 100, mtime: 1000, sha1: 'AAA' } },
      INSTANCE,
    )
    const updates = await computeFileUpdates(
      INSTANCE,
      [file('mods/a.jar', 'AAA')],
      [],
      2000,
      fs,
    )
    expect(updates).toHaveLength(1)
    expect(updates[0].operation).toBe('remove')
  })

  it('materializes a case-only path rename even when the content is unchanged', async () => {
    const oldFile = file('config/ftbquests/ABC.snbt', 'AAA')
    const newFile = file('config/ftbquests/abc.snbt', 'AAA')
    const fs = createFs(
      {
        'config/ftbquests/ABC.snbt': { size: 100, mtime: 1000, sha1: 'AAA' },
        'config/ftbquests/abc.snbt': { size: 100, mtime: 1000, sha1: 'AAA' },
      },
      INSTANCE,
    )

    const updates = await computeFileUpdates(
      INSTANCE,
      [oldFile],
      [newFile],
      2000,
      fs,
      true,
    )

    expect(updates).toEqual([
      { file: oldFile, operation: 'remove' },
      { file: newFile, operation: 'add' },
    ])
  })

  it('materializes a case-only path rename with updated content', async () => {
    const oldFile = file('config/ftbquests/ABC.snbt', 'AAA')
    const newFile = file('config/ftbquests/abc.snbt', 'BBB')
    const fs = createFs(
      {
        'config/ftbquests/ABC.snbt': { size: 100, mtime: 1000, sha1: 'AAA' },
        'config/ftbquests/abc.snbt': { size: 100, mtime: 1000, sha1: 'AAA' },
      },
      INSTANCE,
    )

    const updates = await computeFileUpdates(
      INSTANCE,
      [oldFile],
      [newFile],
      2000,
      fs,
      true,
    )

    expect(updates).toEqual([
      { file: oldFile, operation: 'remove' },
      { file: newFile, operation: 'add' },
    ])
  })

  /**
   * BUG: when a user has modified a file post-install, but the modified
   * content happens to be EXACTLY the new modpack version, we incorrectly
   * mark it as `backup-add`. The correct operation is `keep`, because the
   * disk already matches the desired state and there is nothing to back up.
   *
   * Today the code short-circuits on `oldInstallTime < file.mtime` and
   * never compares against the new file's hash.
   */
  it('marks user-modified file as keep when content matches new version', async () => {
    const fs = createFs(
      // disk file matches the NEW modpack file (sha1=BBB) but mtime is post-install
      { 'mods/a.jar': { size: 200, mtime: 5000, sha1: 'BBB' } },
      INSTANCE,
    )
    const updates = await computeFileUpdates(
      INSTANCE,
      [file('mods/a.jar', 'AAA')], // old version
      [file('mods/a.jar', 'BBB', 200)], // new version
      2000, // install time before disk mtime → "user modified"
      fs,
    )
    expect(updates).toHaveLength(1)
    expect(updates[0].operation).toBe('keep')
  })

  it('marks user-modified file with different new version as backup-add', async () => {
    const fs = createFs(
      // disk file is user-modified to something else (sha1=USER), new is BBB
      { 'mods/a.jar': { size: 150, mtime: 5000, sha1: 'USER' } },
      INSTANCE,
    )
    const updates = await computeFileUpdates(
      INSTANCE,
      [file('mods/a.jar', 'AAA')],
      [file('mods/a.jar', 'BBB', 200)],
      2000,
      fs,
    )
    expect(updates).toHaveLength(1)
    expect(updates[0].operation).toBe('backup-add')
  })

  /**
   * BUG: same scenario for files dropped from the manifest. If the user
   * modified a file post-install AND it's no longer in the new manifest,
   * we mark it as `backup-remove` (correct), but if their content matches
   * the OLD pristine version (i.e., they didn't really modify it, just
   * touched it), we still backup-remove. That's tolerable — the more
   * concerning sibling case is the keep one above.
   */
  it('handles file deletion when user modified it', async () => {
    const fs = createFs(
      { 'mods/a.jar': { size: 150, mtime: 5000, sha1: 'USER' } },
      INSTANCE,
    )
    const updates = await computeFileUpdates(
      INSTANCE,
      [file('mods/a.jar', 'AAA')],
      [],
      2000,
      fs,
    )
    expect(updates[0].operation).toBe('backup-remove')
  })

  it('falls back to hash comparison when oldInstallTime is unknown', async () => {
    const fs = createFs(
      { 'mods/a.jar': { size: 100, mtime: 1000, sha1: 'AAA' } },
      INSTANCE,
    )
    const updates = await computeFileUpdates(
      INSTANCE,
      [file('mods/a.jar', 'AAA')],
      [file('mods/a.jar', 'AAA')],
      undefined,
      fs,
    )
    expect(updates[0].operation).toBe('keep')
  })

  it('falls back to backup-add when oldInstallTime is unknown and disk differs from new', async () => {
    const fs = createFs(
      { 'mods/a.jar': { size: 100, mtime: 1000, sha1: 'AAA' } },
      INSTANCE,
    )
    const updates = await computeFileUpdates(
      INSTANCE,
      [], // unknown old
      [file('mods/a.jar', 'BBB')],
      undefined,
      fs,
    )
    // dontKnowOldFile=true → backup-add when different
    expect(updates[0].operation).toBe('backup-add')
  })
})
