import { describe, it, expect } from 'vitest'
import { copyFile, mkdtemp, rm, writeFile, ensureDir, pathExists, readFile, unlink } from 'fs-extra'
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

describe('InstanceFileOperationHandler', () => {
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
      await handler.prepareInstallFiles(updates, new AbortController().signal)
      await handler.backupAndRename()

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
