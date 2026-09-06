import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { copyFile, mkdtemp, readdir, rm, writeFile, ensureDir, pathExists, readFile, unlink } from 'fs-extra'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import {
  InstanceFileOperationHandler,
  type InstanceFileOperationHandlerContext,
  type FileOperationPayload,
  type HttpTaskPayload,
} from './files_handler'
import type { InstanceFile, InstanceFileUpdate } from './files'

const file = (path: string, sha1: string, downloads?: string[]): InstanceFile => ({
  path,
  hashes: { sha1 },
  downloads,
})

function createContext(
  overrides: Partial<InstanceFileOperationHandlerContext> = {},
): InstanceFileOperationHandlerContext {
  return {
    worker: { checksum: async () => '' },
    logger: { warn: () => {}, log: () => {} },
    onSpecialFile: () => {},
    getCachedResource: async () => undefined,
    getPeerActualUrl: async () => undefined,
    unzipFiles: async () => {},
    downloadFiles: async () => {},
    linkFiles: async () => {},
    ...overrides,
  }
}

async function setupDirs() {
  const root = await mkdtemp(join(tmpdir(), 'xmcl-handler-'))
  const instance = join(root, 'instance')
  const workspace = join(root, 'workspace')
  const backup = join(root, 'backup')
  await ensureDir(instance)
  return { root, instance, workspace, backup }
}

async function checksumFile(path: string, algorithm: 'sha1' | 'sha256' | 'sha512') {
  return createHash(algorithm).update(await readFile(path)).digest('hex')
}

describe('InstanceFileOperationHandler', () => {
  it('rejects a cached SHA1 match when the stronger declared checksum differs', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      const cached = join(root, 'cached.jar')
      await writeFile(cached, 'cached')
      const target = {
        ...file('mods/a.jar', await checksumFile(cached, 'sha1'), ['https://example.invalid/a.jar']),
        hashes: { sha1: await checksumFile(cached, 'sha1'), sha512: '0'.repeat(128) },
      }
      const links: FileOperationPayload[] = []
      const downloads: HttpTaskPayload[] = []
      const handler = new InstanceFileOperationHandler(instance, new Set(), workspace, backup, createContext({
        worker: { checksum: async (path, algorithm) => createHash(algorithm).update(await readFile(path)).digest('hex') },
        getCachedResource: async () => cached,
        linkFiles: async payloads => { links.push(...payloads) },
        downloadFiles: async payloads => { downloads.push(...payloads) },
      }))
      await handler.prepareInstallFiles([{ operation: 'add', file: target }], new AbortController().signal)
      expect(links).toEqual([])
      expect(downloads.map(payload => payload.file.path)).toEqual([target.path])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.skipIf(process.platform !== 'win32')('does not delete a newly published case-only rename', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      await ensureDir(join(instance, 'mods'))
      await ensureDir(join(workspace, 'mods'))
      await writeFile(join(instance, 'mods', 'Old.jar'), 'old')
      await writeFile(join(workspace, 'mods', 'old.jar'), 'new')
      const handler = new InstanceFileOperationHandler(instance, new Set(['mods/old.jar']), workspace, backup, createContext())
      await handler.commitReadyFiles([
        { operation: 'remove', file: file('mods/Old.jar', 'old') },
        { operation: 'add', file: file('mods/old.jar', 'new') },
      ], true, async () => {})
      expect(await readFile(join(instance, 'mods', 'old.jar'), 'utf8')).toBe('new')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('preserves same-size user edits when a backup-remove collides with an earlier backup', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      await ensureDir(join(instance, 'config'))
      await ensureDir(join(backup, 'config'))
      await writeFile(join(instance, 'config', 'a.txt'), 'new')
      await writeFile(join(backup, 'config', 'a.txt'), 'old')
      const handler = new InstanceFileOperationHandler(instance, new Set(), workspace, backup, createContext({
        worker: { checksum: async (path, algorithm) => createHash(algorithm).update(await readFile(path)).digest('hex') },
      }))
      await handler.commitReadyFiles([{ operation: 'backup-remove', file: file('config/a.txt', 'old') }], true, async () => {})
      expect(await readFile(join(backup, 'config', 'a.txt'), 'utf8')).toBe('old')
      expect(await readFile(join(backup, 'config', 'a.txt.1'), 'utf8')).toBe('new')
      expect(await pathExists(join(instance, 'config', 'a.txt'))).toBe(false)
      expect([...handler.removed]).toEqual(['config/a.txt'])
      await handler.commitReadyFiles([], false, async () => {})
      expect(handler.removed.size).toBe(0)
      expect(handler.committed.size).toBe(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('settles unzip writers after a download fails and publishes their ready files', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      const failure = new Error('offline')
      const releaseZip = Promise.withResolvers<void>()
      const downloadFailed = Promise.withResolvers<void>()
      const handler = new InstanceFileOperationHandler(instance, new Set(), workspace, backup, createContext({
        unzipFiles: async (payloads, finished) => {
          await releaseZip.promise
          for (const payload of payloads) {
            await ensureDir(dirname(payload.destination))
            await writeFile(payload.destination, 'ready')
            finished.add(payload.file.path)
          }
        },
        downloadFiles: async () => {
          downloadFailed.resolve()
          throw failure
        },
      }))
      const updates: InstanceFileUpdate[] = [
        { operation: 'add', file: file('config/ready.txt', 'ready', ['zip:///pack.zip?entry=config/ready.txt']) },
        { operation: 'add', file: file('mods/missing.jar', 'missing', ['https://example.com/missing.jar']) },
        { operation: 'remove', file: file('mods/old.jar', 'old') },
      ]
      await ensureDir(join(instance, 'mods'))
      await writeFile(join(instance, 'mods', 'old.jar'), 'old')
      let settled = false
      const prepared = handler.prepareInstallFiles(updates, new AbortController().signal)
        .catch(error => { settled = true; return error })
      await downloadFailed.promise
      await new Promise(resolve => setTimeout(resolve, 10))
      expect(settled).toBe(false)
      releaseZip.resolve()
      expect(await prepared).toBe(failure)
      await handler.commitReadyFiles(updates, false, async () => {})
      expect(await readFile(join(instance, 'config', 'ready.txt'), 'utf8')).toBe('ready')
      expect(await pathExists(join(instance, 'mods', 'missing.jar'))).toBe(false)
      expect(await readFile(join(instance, 'mods', 'old.jar'), 'utf8')).toBe('old')
      expect([...handler.committed]).toEqual(['config/ready.txt'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('retains successful promotions and the original file if another replacement fails', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      await ensureDir(join(instance, 'mods'))
      await ensureDir(join(workspace, 'mods'))
      await writeFile(join(instance, 'mods', 'old.jar'), 'original')
      await writeFile(join(workspace, 'mods', 'ready.jar'), 'ready')
      const handler = new InstanceFileOperationHandler(instance,
        new Set(['mods/ready.jar', 'mods/old.jar']), workspace, backup, createContext())
      const updates: InstanceFileUpdate[] = [
        { operation: 'add', file: file('mods/ready.jar', 'ready') },
        { operation: 'backup-add', file: file('mods/old.jar', 'replacement') },
      ]
      await expect(handler.commitReadyFiles(updates, true, async () => {})).rejects.toThrow()
      expect(await readFile(join(instance, 'mods', 'ready.jar'), 'utf8')).toBe('ready')
      expect(await readFile(join(instance, 'mods', 'old.jar'), 'utf8')).toBe('original')
      expect(await readFile(join(backup, 'mods', 'old.jar'), 'utf8')).toBe('original')
      expect([...handler.committed]).toEqual(['mods/ready.jar'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each(['.install/op.json', 'config/../.install-profile', '.INSTALL\\op\\files\\a'])(
    'rejects files targeting installer state: %s', async (path) => {
      const { root, instance, workspace, backup } = await setupDirs()
      try {
        const handler = new InstanceFileOperationHandler(instance, new Set(), workspace, backup, createContext())
        await expect(handler.prepareInstallFiles([{ file: file(path, 'hash'), operation: 'add' }],
          new AbortController().signal)).rejects.toThrow('Invalid instance install path')
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    },
  )

  /**
   * BUG B: When `linkFiles` returns a file in the `unhandled` array,
   * `prepareInstallFiles` falls back to `#handleHttp(file, destination)`
   * WITHOUT passing the file's sha1. The resulting download payload has
   * no validator, so a corrupted/MITM'd download is silently accepted.
   */
  it('passes sha1 to fallback http payload when link is unhandled', async () => {
    const { instance, workspace, backup } = await setupDirs()
    try {
      // Create a fake "cached resource" so #handleLink succeeds
      const cached = join(workspace, '.cache', 'AAA.jar')
      await ensureDir(join(workspace, '.cache'))
      await writeFile(cached, 'data')

      const httpPayloads: HttpTaskPayload[] = []
      const ctx = createContext({
        getCachedResource: async (sha1) => (sha1 === 'AAA' ? cached : undefined),
        // Simulate linkFiles deciding the file cannot be linked
        // (e.g., source vanished mid-link). Push to unhandled so the
        // handler's fallback runs.
        linkFiles: async (payloads, _finished, unhandled) => {
          for (const p of payloads) unhandled.push(p.file)
        },
        downloadFiles: async (payloads) => {
          httpPayloads.push(...payloads)
        },
      })

      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )

      const update: InstanceFileUpdate = {
        file: file('mods/a.jar', 'AAA', ['https://example.com/a.jar']),
        operation: 'add',
      }
      await handler.prepareInstallFiles([update], new AbortController().signal)

      expect(httpPayloads).toHaveLength(1)
      expect(httpPayloads[0].options.sha1).toBe('AAA')
    } finally {
      await rm((await setupDirs()).root, { recursive: true, force: true }).catch(() => {})
    }
  })

  /**
   * BUG E: If a file in the `backupQueue` has been removed from disk
   * between delta computation and `backupAndRename`, the renaming step
   * fails with ENOENT and the entire install aborts (with "best effort"
   * rollback).
   *
   * The expected behaviour is to treat ENOENT during backup as "already
   * gone, nothing to back up" and continue.
   */
  it('tolerates missing files in the backup queue (ENOENT race)', async () => {
    const { instance, workspace, backup } = await setupDirs()
    try {
      const ctx = createContext()
      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )

      // Use an "operation = remove" file that is NOT actually on disk —
      // simulating a race where the user deleted the file already.
      const ghost: InstanceFileUpdate = {
        file: file('mods/ghost.jar', 'AAA'),
        operation: 'remove',
      }
      await handler.prepareInstallFiles([ghost], new AbortController().signal)

      // Should not throw — ENOENT during backup must be tolerated.
      await expect(handler.backupAndRename()).resolves.toBeUndefined()
    } finally {
      // best-effort cleanup
    }
  })

  it('properly performs phase-3 rename of downloaded files into instance', async () => {
    const { instance, workspace, backup } = await setupDirs()
    try {
      // Place a file in workspace as if it was downloaded
      const wsFile = join(workspace, 'mods', 'a.jar')
      await ensureDir(join(workspace, 'mods'))
      await writeFile(wsFile, 'downloaded')

      const ctx = createContext({
        // simulate the download having already happened (file present in ws)
        downloadFiles: async (payloads, finished) => {
          for (const p of payloads) finished.add(p.file.path)
        },
      })

      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )

      const update: InstanceFileUpdate = {
        file: file('mods/a.jar', 'AAA', ['https://example.com/a.jar']),
        operation: 'add',
      }
      await handler.prepareInstallFiles([update], new AbortController().signal)
      await handler.backupAndRename()

      const installed = join(instance, 'mods', 'a.jar')
      expect(await pathExists(installed)).toBe(true)
      expect((await readFile(installed)).toString()).toBe('downloaded')
    } finally {
      // best-effort cleanup
    }
  })

  it('materializes keeps so a refreshed delta can commit them later', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      const instanceFile = join(instance, 'mods', 'a.jar')
      await ensureDir(join(instance, 'mods'))
      await writeFile(instanceFile, 'prepared')
      const ctx = createContext({
        linkFiles: async (payloads, finished) => {
          for (const payload of payloads) {
            await ensureDir(join(workspace, 'mods'))
            await copyFile(payload.src, payload.destination)
            finished.add(payload.file.path)
          }
        },
      })
      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )
      const target = file('mods/a.jar', 'AAA')

      await handler.prepareInstallFiles(
        [{ file: target, operation: 'keep' }],
        new AbortController().signal,
        true,
      )
      await unlink(instanceFile)
      await handler.backupAndRename([{ file: target, operation: 'add' }])

      expect(await readFile(instanceFile, 'utf8')).toBe('prepared')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not reuse a staged file when only a weaker checksum matches', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      const workspaceFile = join(workspace, 'mods', 'a.jar')
      await ensureDir(dirname(workspaceFile))
      await writeFile(workspaceFile, 'stale-content')

      const httpPayloads: HttpTaskPayload[] = []
      const actualSha1 = await checksumFile(workspaceFile, 'sha1')
      const ctx = createContext({
        worker: {
          checksum: async (path: string, algorithm: string) => {
            if (algorithm === 'sha1' || algorithm === 'sha256' || algorithm === 'sha512') {
              return checksumFile(path, algorithm)
            }
            return '0'
          },
        },
        downloadFiles: async (payloads) => {
          httpPayloads.push(...payloads)
        },
      })
      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )
      const update: InstanceFileUpdate = {
        file: {
          path: 'mods/a.jar',
          hashes: {
            sha1: actualSha1,
            sha512: '0'.repeat(128),
          },
          downloads: ['https://example.com/a.jar'],
        },
        operation: 'add',
      }

      await handler.prepareInstallFiles([update], new AbortController().signal)

      expect(httpPayloads).toHaveLength(1)
      expect(handler.finished.has('mods/a.jar')).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not back up an existing file when its replacement is unresolved', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      const instanceFile = join(instance, 'mods', 'a.jar')
      await ensureDir(join(instance, 'mods'))
      await writeFile(instanceFile, 'existing')
      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        createContext(),
      )
      const target = file('mods/a.jar', 'AAA')

      await handler.prepareInstallFiles(
        [{ file: target, operation: 'add' }],
        new AbortController().signal,
        true,
      )
      await handler.backupAndRename([{ file: target, operation: 'backup-add' }])

      expect(await readFile(instanceFile, 'utf8')).toBe('existing')
      expect(await pathExists(join(backup, 'mods', 'a.jar'))).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('preserves the first backup and stores later user edits in a distinct retry backup', async () => {
    const { root, instance, workspace, backup } = await setupDirs()
    try {
      const instanceFile = join(instance, 'mods', 'a.jar')
      await ensureDir(dirname(instanceFile))
      await writeFile(instanceFile, 'ORIGINAL')

      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(['mods/a.jar']),
        workspace,
        backup,
        createContext(),
      )
      const updates: InstanceFileUpdate[] = [
        { file: file('mods/a.jar', 'AAA'), operation: 'backup-add' },
      ]

      await expect(handler.commitReadyFiles(updates, false, async () => {})).rejects.toThrow()
      expect(await readFile(join(backup, 'mods', 'a.jar'), 'utf8')).toBe('ORIGINAL')
      expect(await readFile(instanceFile, 'utf8')).toBe('ORIGINAL')

      await writeFile(instanceFile, 'USER-EDIT')
      await ensureDir(join(workspace, 'mods'))
      await writeFile(join(workspace, 'mods', 'a.jar'), 'REPLACEMENT')
      handler.finished.add('mods/a.jar')

      await handler.commitReadyFiles(updates, false, async () => {})

      const backupDir = join(backup, 'mods')
      const backupFiles = (await readdir(backupDir)).sort()
      const retryBackup = backupFiles.find((name) => name !== 'a.jar')
      expect(backupFiles).toContain('a.jar')
      expect(retryBackup).toBeTruthy()
      expect(await readFile(join(backupDir, 'a.jar'), 'utf8')).toBe('ORIGINAL')
      expect(await readFile(join(backupDir, retryBackup!), 'utf8')).toBe('USER-EDIT')
      expect(await readFile(instanceFile, 'utf8')).toBe('REPLACEMENT')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  /**
   * BUG F (atomic recovery): when a crash interrupts the install
   * between phase 1 (prepare) and phase 3 (rename), the workspace
   * folder still contains all the files that completed in phase 1.
   * Resume re-invokes `prepareInstallFiles`, which calls
   * `#dispatchFileTask` for each file. Because the file already
   * exists in the workspace with the correct hash, dispatchFileTask
   * returns early WITHOUT pushing the file to any queue. Phase 3's
   * rename loop then skips it, and `remove(workspacePath)` at the
   * end of `backupAndRename` DELETES it. The instance silently ends
   * up missing files that were already downloaded.
   */
  it('does not lose files that are already complete in the workspace on resume', async () => {
    const { instance, workspace, backup } = await setupDirs()
    try {
      // Simulate a previous prep that left the file in the workspace.
      await ensureDir(join(workspace, 'mods'))
      const wsFile = join(workspace, 'mods', 'a.jar')
      await writeFile(wsFile, 'previously-downloaded')

      // The handler is given the matching sha1 so it short-circuits.
      const sha1 = 'PREVIOUSLY_DOWNLOADED_HASH'
      const ctx = createContext({
        worker: {
          checksum: async () => sha1,
        },
      })

      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(['mods/a.jar']), // resume: file marked finished in profile
        workspace,
        backup,
        ctx,
      )

      const update: InstanceFileUpdate = {
        file: file('mods/a.jar', sha1, ['https://example.com/a.jar']),
        operation: 'add',
      }
      await handler.prepareInstallFiles([update], new AbortController().signal)
      await handler.backupAndRename()

      const installed = join(instance, 'mods', 'a.jar')
      expect(await pathExists(installed)).toBe(true)
      expect((await readFile(installed)).toString()).toBe('previously-downloaded')
    } finally {
      // best-effort cleanup
    }
  })

  /**
   * BUG G (atomic recovery): phase 3's rollback only un-does the
   * SUCCESSFUL phase 3 renames (instance → workspace). It does NOT
   * roll back phase 2 (instance → backup). For a `backup-add` file
   * whose phase-3 rename was rolled back, the OLD content sits in
   * backup/, the NEW content sits in workspace/, and instance/
   * has a hole.
   *
   * Expected: on phase-3 failure, the install is left in a state
   * where every file the user previously had is still present in
   * the instance folder (either the original or the new version).
   */
  it('restores phase 2 backups when phase 3 fails partway', async () => {
    const { instance, workspace, backup } = await setupDirs()
    try {
      // Pre-existing OLD file in instance (will be backup-add'd)
      await ensureDir(join(instance, 'mods'))
      await writeFile(join(instance, 'mods', 'a.jar'), 'OLD-A-CONTENT')

      const ctx = createContext({
        // Pretend the new files were materialised by the linker into
        // the workspace.  We then delete b.jar after prep so that
        // phase 3 fails partway.
        linkFiles: async (payloads, finished) => {
          for (const p of payloads) {
            await ensureDir(dirname(p.destination))
            await writeFile(p.destination, `NEW-${p.file.path}`)
            finished.add(p.file.path)
          }
        },
        getCachedResource: async () => '/fake/cached/resource',
      })

      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )

      const updates: InstanceFileUpdate[] = [
        {
          // backup-add: phase 2 will move OLD a.jar to backup
          file: file('mods/a.jar', 'HASH_A_NEW'),
          operation: 'backup-add',
        },
        {
          // add: just placed in workspace
          file: file('mods/b.jar', 'HASH_B_NEW'),
          operation: 'add',
        },
      ]
      await handler.prepareInstallFiles(updates, new AbortController().signal)

      // Sanity: linker put both into workspace
      expect(await pathExists(join(workspace, 'mods', 'a.jar'))).toBe(true)
      expect(await pathExists(join(workspace, 'mods', 'b.jar'))).toBe(true)

      // Force phase 3 to fail partway by deleting b.jar from workspace
      // BEFORE backupAndRename runs.  rename(workspace/b.jar) -> ENOENT.
      await rm(join(workspace, 'mods', 'b.jar'))

      await expect(handler.backupAndRename()).rejects.toThrow()

      // After failure, the user must NOT see a hole.  mods/a.jar should
      // either contain the new content (install effectively succeeded
      // for that file) OR the original content (full rollback).  The
      // pathological state is a missing file with old content trapped
      // in backup/.
      const installedExists = await pathExists(join(instance, 'mods', 'a.jar'))
      expect(installedExists).toBe(true)
    } finally {
      // best-effort cleanup
    }
  })
})

/**
 * Adversarial / hacker-mode tests.
 *
 * These tests model a malicious modpack manifest trying to abuse the
 * install pipeline as an attack surface (path escape, info disclosure,
 * integrity bypass, denial of recovery).
 */
describe('InstanceFileOperationHandler — adversarial', () => {
  /**
   * Sanity: a manifest that puts `..` in `file.path` must NOT cause any
   * write outside the instance directory. Today this is enforced by
   * `#handleFile`'s `relative(...).startsWith('..')` check.
   */
  it('does not allow path traversal via "../" in file.path', async () => {
    const { instance, workspace, backup, root } = await setupDirs()
    try {
      const escapeMarker = join(root, 'ESCAPE.txt')
      const linked: FileOperationPayload[] = []

      const ctx = createContext({
        getCachedResource: async () => '/some/source',
        linkFiles: async (payloads, finished) => {
          linked.push(...payloads)
          for (const p of payloads) {
            await ensureDir(dirname(p.destination))
            await writeFile(p.destination, 'attacker-content')
            finished.add(p.file.path)
          }
        },
      })

      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )

      const updates: InstanceFileUpdate[] = [
        {
          file: { path: '../../ESCAPE.txt', hashes: { sha1: 'AAA' } },
          operation: 'add',
        },
      ]
      await expect(handler.prepareInstallFiles(updates, new AbortController().signal))
        .rejects.toThrow('Invalid instance install path')
      await expect(handler.commitReadyFiles(updates, true, async () => {}))
        .rejects.toThrow('Invalid instance install path')
      expect(await pathExists(escapeMarker)).toBe(false)
      // No queue entry should have been produced for the escaping path
      expect(linked).toHaveLength(0)
    } finally {
      // best-effort cleanup
    }
  })

  /**
   * BUG H — `file://` URL info-disclosure.
   *
   * `#handleLink` accepts ANY `file://` URL as a valid source, links it
   * into the workspace, and never re-checks whether the linked content
   * matches the manifest's declared hash. A malicious modpack can put
   *
   *     downloads: ["file:///home/user/.ssh/id_rsa"]
   *     hashes: { sha1: "ANYTHING" }
   *     path: "mods/looks-legit.jar"
   *
   * and the launcher will silently exfiltrate that file into the user's
   * mod folder, where it can be uploaded by any "share modpack" feature,
   * scraped by another mod, etc.
   *
   * Expected: the file:// branch must verify the linked content matches
   * the declared hash; mismatches must NOT be installed.
   */
  it('does not silently install file:// URLs that do not match the declared hash', async () => {
    const { instance, workspace, backup, root } = await setupDirs()
    try {
      // A "sensitive" file the launcher process can read but the
      // modpack should not be able to leak.
      const sensitive = join(root, 'sensitive.txt')
      await writeFile(sensitive, 'TOP-SECRET')

      const ctx = createContext({
        worker: {
          // Real sha1 of "TOP-SECRET" is some value; manifest claims a
          // different value.
          checksum: async (path: string) => {
            const content = (await readFile(path)).toString()
            return content === 'TOP-SECRET' ? 'ACTUAL_SECRET_HASH' : 'OTHER'
          },
        },
        linkFiles: async (payloads, finished) => {
          for (const p of payloads) {
            await ensureDir(dirname(p.destination))
            // simulate real linking: copy the source byte-for-byte
            await writeFile(p.destination, await readFile(p.src))
            finished.add(p.file.path)
          }
        },
      })

      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )

      const updates: InstanceFileUpdate[] = [
        {
          file: {
            path: 'mods/looks-legit.jar',
            hashes: { sha1: 'EXPECTED_LEGIT_HASH' }, // not the real hash
            downloads: [`file://${sensitive.replace(/\\/g, '/')}`],
          },
          operation: 'add',
        },
      ]
      await handler.prepareInstallFiles(updates, new AbortController().signal)
      await handler.backupAndRename().catch(() => {})

      const installed = join(instance, 'mods', 'looks-legit.jar')
      // If the file landed in the instance, its content MUST NOT be
      // the sensitive content.
      if (await pathExists(installed)) {
        const content = (await readFile(installed)).toString()
        expect(content).not.toBe('TOP-SECRET')
      } else {
        // Or it must have been routed to unresolvable.
        expect(handler.unresolvable.map((f) => f.path)).toContain('mods/looks-legit.jar')
      }
    } finally {
      // best-effort cleanup
    }
  })

  /**
   * BUG I — CRC32 / SHA256 / SHA512-only files lose their integrity
   * check.
   *
   * `#handleHttp` packs only `sha1` into the download payload. The
   * service mapping uses `v.options.sha1` to decide whether to attach a
   * validator. So a file whose manifest only carries a `sha256` (or
   * `sha512`, or `crc32`) hash is downloaded with no integrity check at
   * all — silent acceptance of MITM / corruption.
   *
   * Expected: the http payload must carry enough information for the
   * service to attach SOME validator.
   */
  it('exposes non-sha1 hashes on the http payload so a validator can be derived', async () => {
    const { instance, workspace, backup } = await setupDirs()
    try {
      const httpPayloads: HttpTaskPayload[] = []
      const ctx = createContext({
        downloadFiles: async (payloads) => {
          httpPayloads.push(...payloads)
        },
      })
      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(),
        workspace,
        backup,
        ctx,
      )

      const sha256Only: InstanceFile = {
        path: 'mods/a.jar',
        hashes: { sha256: 'SHA256_VALUE' },
        downloads: ['https://example.com/a.jar'],
      }
      await handler.prepareInstallFiles(
        [{ file: sha256Only, operation: 'add' }],
        new AbortController().signal,
      )

      expect(httpPayloads).toHaveLength(1)
      const payload = httpPayloads[0]
      // The payload must allow the downstream service to derive a
      // validator. Either:
      //   - the file is exposed (so service can read file.hashes), AND
      //   - file.hashes carries the original sha256.
      expect(payload.file.hashes.sha256).toBe('SHA256_VALUE')
    } finally {
      // best-effort cleanup
    }
  })

  /**
   * BUG J — Resume can wedge the install if the workspace folder was
   * removed but `.install-profile.finishedPath` still claims files are
   * done.
   *
   * `prepareInstallFiles` seeds its `finished` set from `finishedPath`.
   * `linkInstanceFiles` short-circuits on `finished.has(path)` without
   * verifying the file is actually in the workspace. Phase 3 then tries
   * to rename a workspace file that was never created, fails, and
   * (post-fix) rolls back. The install can never recover until the user
   * manually deletes `.install-profile`.
   *
   * Expected: prepareInstallFiles should re-materialise files in the
   * workspace whenever the workspace copy is missing, regardless of
   * what `finishedPath` says.
   */
  it('re-runs phase 1 when finishedPath claims a file is done but the workspace copy is gone', async () => {
    const { instance, workspace, backup } = await setupDirs()
    try {
      let materialised = false
      const ctx = createContext({
        getCachedResource: async () => '/fake/cache/source',
        // Mirror the real `linkInstanceFiles` behaviour: skip jobs whose
        // path is already in the `finished` set. This is what causes
        // the bug in production.
        linkFiles: async (payloads, finished) => {
          for (const p of payloads) {
            if (finished.has(p.file.path)) continue
            await ensureDir(dirname(p.destination))
            await writeFile(p.destination, 'fresh-from-cache')
            finished.add(p.file.path)
            materialised = true
          }
        },
      })

      // Resume scenario: previous run finished phase 1 for mods/a.jar
      // and recorded it in finishedPath, but the workspace folder was
      // wiped (e.g., user cleaned tmp).
      const handler = new InstanceFileOperationHandler(
        instance,
        new Set(['mods/a.jar']),
        workspace,
        backup,
        ctx,
      )

      const updates: InstanceFileUpdate[] = [
        {
          file: file('mods/a.jar', 'AAA', ['https://example.com/a.jar']),
          operation: 'add',
        },
      ]
      await handler.prepareInstallFiles(updates, new AbortController().signal)
      // The link function MUST have actually materialised the file —
      // it cannot trust the seeded `finished` set when the workspace
      // copy is missing.
      expect(materialised).toBe(true)

      await handler.backupAndRename()

      const installed = join(instance, 'mods', 'a.jar')
      expect(await pathExists(installed)).toBe(true)
    } finally {
      // best-effort cleanup
    }
  })
})
