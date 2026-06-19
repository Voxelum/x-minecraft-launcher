import { chmod, copyFile, ensureDir, lstat, readdir, readlink, remove, rename, rmdir, symlink, utimes, writeFile } from 'fs-extra'
import { join, resolve } from 'path'
import { Logger } from '~/infra'
import type { LauncherApp } from './LauncherApp'
import { isSystemError } from '@xmcl/utils'
import type { MigrationProgress } from '@xmcl/runtime-api'

/**
 * Called for every file that is physically copied across volumes, with the
 * number of bytes copied and the destination path. Same-volume renames are
 * effectively free and never reported here — the caller reconciles those
 * against the pre-computed size instead.
 */
type OnCopied = (bytes: number, file: string) => void

/**
 * Move `from` to `to`.
 *
 * Unlike a plain `rename`, this merges into an existing destination directory
 * instead of failing with `ENOTEMPTY`. This matters because the destination
 * validation explicitly accepts an existing XMCL data directory as a target,
 * and a plain rename of `oldRoot/versions -> newRoot/versions` throws when
 * `newRoot/versions` already exists, which previously caused the whole
 * migration to roll back silently ("nothing happens").
 *
 * Symlinks are recreated as links and never followed. Instances keep their
 * `versions`/`libraries` folders as symlinks back to the shared root, so
 * following one (the default `stat` behaviour) would copy the root's contents
 * into the instance and then `remove()` them *through* the link — silently
 * wiping the real version jars from the root. That is the "my Minecraft
 * version jar is gone after moving the data" report.
 *
 * Falls back to copy + remove across different volumes (`EXDEV`). The optional
 * `onCopied` callback receives byte-level progress for that slow cross-volume
 * path so the UI can render a smooth, determinate progress bar.
 */
async function move(from: string, to: string, onCopied?: OnCopied) {
  // `lstat`, never `stat`: we must see a symlink as a link, not as its target.
  const fromStat = await lstat(from).catch(() => undefined)
  if (!fromStat) return

  if (fromStat.isSymbolicLink()) {
    // Recreate the link itself at the destination rather than its target. The
    // target is an absolute path into the old root; the instance launch
    // precheck relinks any stale target to the new root on next launch.
    const target = await readlink(from).catch(() => null)
    if (target) {
      await remove(to).catch(() => { })
      await symlink(target, to).catch(() => { })
    }
    await remove(from).catch(() => { })
    return
  }

  const toStat = await lstat(to).catch(() => undefined)

  // Both sides are directories: merge child by child instead of failing.
  if (fromStat.isDirectory() && toStat?.isDirectory()) {
    const children = await readdir(from)
    for (const child of children) {
      await move(join(from, child), join(to, child), onCopied)
    }
    // Only removes the source directory once it is empty.
    await rmdir(from).catch(() => { })
    return
  }

  try {
    // The source is authoritative during a migration: replace an existing
    // destination file so the rename below does not fail (e.g. on Windows).
    if (toStat && !fromStat.isDirectory()) {
      await remove(to)
    }
    await rename(from, to)
  } catch (e) {
    if (isSystemError(e) && e.code === 'EXDEV') {
      // Different volume: rename is impossible, copy then remove.
      if (fromStat.isDirectory()) {
        await ensureDir(to)
        const children = await readdir(from)
        for (const child of children) {
          await move(join(from, child), join(to, child), onCopied)
        }
        await rmdir(from).catch(() => { })
      } else {
        // A regular file across volumes (symlinks were handled above). Copy
        // with the low-level `copyFile` to avoid fs-extra's per-file `mkdirs`
        // + `lstat` overhead, which is a real win for the thousands of tiny
        // files under assets/libraries where cross-volume migrations spend
        // most of their time. The destination directory is guaranteed to
        // exist (the directory branch above ran `ensureDir`, or this is a
        // top-level file landing in the migration root).
        await copyFile(from, to)
        // Preserve mode (the JRE ships executable binaries) and timestamps
        // (resource caches key off mtime); failures here must not abort the
        // migration on filesystems that ignore these attributes (e.g. NTFS
        // mounted via ntfs-3g).
        await chmod(to, fromStat.mode).catch(() => { })
        await utimes(to, fromStat.atime, fromStat.mtime).catch(() => { })
        await remove(from)
        onCopied?.(fromStat.size, to)
      }
    } else {
      throw e
    }
  }
}

/**
 * Recursively sum the byte size and file count of `path` using metadata only.
 * Cheap relative to the copy that follows, and lets the progress bar be
 * determinate instead of an endless spinner.
 */
async function computeSize(path: string): Promise<{ bytes: number; files: number }> {
  // `lstat` so a symlink is weighed as a single zero-byte entry instead of its
  // (possibly huge, possibly shared) target — `move` only recreates the link,
  // it never copies the target, so counting the target here would both
  // double-count shared roots reached via instance symlinks and stop the bar
  // from ever reaching 100%.
  const s = await lstat(path).catch(() => undefined)
  if (!s) return { bytes: 0, files: 0 }
  if (s.isSymbolicLink()) return { bytes: 0, files: 1 }
  if (s.isDirectory()) {
    const children = await readdir(path)
    let bytes = 0
    let files = 0
    for (const child of children) {
      const r = await computeSize(join(path, child))
      bytes += r.bytes
      files += r.files
    }
    return { bytes, files }
  }
  return { bytes: s.size, files: 1 }
}

export async function handleMigrateRoot(source: string, logger: Logger, app: LauncherApp) {
  // Use the last occurrence: a stale `--migrate` can be carried forward into a
  // relaunch (e.g. by the updater reusing the current argv), so the freshest
  // destination wins.
  const migrateIndex = process.argv.lastIndexOf('--migrate')
  const destination = process.argv[migrateIndex + 1]
  if (migrateIndex === -1 || !destination) {
    return source
  }
  // Nothing to do if the destination is already the current root. This avoids
  // popping the migration window (and useless work) when a stale `--migrate`
  // flag survives a relaunch.
  if (resolve(source) === resolve(destination)) {
    return source
  }
  const candidates = [
    'assets',
    'instances',
    'jre',
    'libraries',
    'labymod-neo',
    'modpacks',
    'mods',
    'resourcepacks',
    'saves',
    'shaderpacks',
    'versions',
    'authlib-injection.json',
    'ely-authlib.json',
    'launcher_profiles.json',
    'options.txt',
    'servers.dat',
  ]
  const finished = [] as Array<{ from: string, to: string }>
  try {
    logger.log(`Try to use rename to migrate the files: ${source} -> ${destination}`)

    // The progress window is purely cosmetic — never let its failure abort
    // the migration itself.
    Promise.resolve(app.controller.startMigrate()).catch((e) => {
      logger.warn('Failed to show the migration window', e)
    })

    // The single source of truth for the progress window. Mutated in place and
    // pushed to the renderer on a throttle so a fast stream of tiny-file copies
    // cannot flood the IPC channel.
    const state: MigrationProgress = {
      from: source,
      to: destination,
      file: '',
      copiedBytes: 0,
      totalBytes: 0,
      copiedFiles: 0,
      totalFiles: 0,
      phase: 'scanning',
    }
    app.controller.handle('migration-get-progress', () => ({ ...state }))

    let lastBroadcast = 0
    const broadcast = (force = false) => {
      const now = Date.now()
      // ~15 fps is plenty for a progress bar and keeps the IPC traffic low even
      // when copying many tiny files.
      if (!force && now - lastBroadcast < 64) return
      lastBroadcast = now
      app.controller.broadcast('migration-event', { event: 'progress', payload: { ...state } })
    }

    const files = await readdir(source).then(files => files.filter(file => candidates.includes(file)))

    // Phase 1: scan sizes so the bar can be determinate. Metadata only, so it
    // is cheap next to the copy that follows.
    const sizes = new Map<string, { bytes: number; files: number }>()
    for (const file of files) {
      const size = await computeSize(join(source, file))
      sizes.set(file, size)
      state.totalBytes += size.bytes
      state.totalFiles += size.files
    }
    broadcast(true)

    // Phase 2: actually move the data.
    state.phase = 'migrating'
    for (const file of files) {
      const from = join(source, file)
      const to = join(destination, file)
      const size = sizes.get(file)!
      const baseBytes = state.copiedBytes
      const baseFiles = state.copiedFiles
      state.file = from
      broadcast(true)
      try {
        logger.log(`Move ${from} -> ${to}`)
        await move(from, to, (bytes, copiedFile) => {
          state.copiedBytes += bytes
          state.copiedFiles += 1
          state.file = copiedFile
          broadcast()
        })
        finished.push({ from, to })
        // A same-volume rename moves the whole entry atomically without firing
        // the per-file callback, so reconcile the counters against the scan to
        // keep the bar honest (also covers skipped symlinks on the slow path).
        state.copiedBytes = Math.max(state.copiedBytes, baseBytes + size.bytes)
        state.copiedFiles = Math.max(state.copiedFiles, baseFiles + size.files)
        broadcast(true)
      } catch (e) {
        logger.warn(`Fail to move ${from} -> ${to}`, e)
        app.controller.broadcast('migration-event', { event: 'error', payload: { file: from, error: e } })
        throw e
      }
    }

    state.phase = 'done'
    state.file = ''
    broadcast(true)

    await writeFile(join(app.appDataPath, 'root'), destination)
    app.controller.endMigrate({
      from: source,
      to: destination,
    })
    return destination
  } catch (e) {
    // rollback
    logger.warn(`Fail to migrate, rollback`, e)
    for (const { from, to } of finished) {
      try {
        logger.log(`Rollback ${to} -> ${from}`)
        await move(to, from)
      } catch (e) {
        logger.warn(`Fail to rollback ${to} -> ${from}`, e)
      }
    }
    app.controller.endMigrate()
    return source
  }
}